import "server-only";
import { qualified } from "@/db/qualified";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { Transaction } from "@/db/create-db";
import { patients, patientStaff, staffProfiles, staffTherapies, therapies, users } from "@/db/schema";
import type { StaffType } from "@/db/schema/enums";
import { assertCan, ForbiddenError, scopeFor, type Actor } from "@/lib/permissions";
import type { setStaffActiveSchema, staffProfileSchema, updateStaffSchema } from "@/lib/validation/clinical";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { insertStaffLogin } from "./staff";

export type StaffRow = {
  id: string;
  fullName: string;
  staffType: StaffType;
  title: string | null;
  therapyNames: string[];
  isVerified: boolean;
  active: boolean;
  hasLogin: boolean;
  phone: string | null;
  joinedOn: string | null;
  assignedPatients: number;
};

const therapyNamesSql = sql<string[]>`coalesce((select array_agg(t.short_name order by t.sort_order) from ${staffTherapies} st join ${therapies} t on t.id = st.therapy_id where st.staff_profile_id = ${qualified(staffProfiles.id)}), '{}')`;
const therapySlugsSql = sql<string[]>`coalesce((select array_agg(t.slug order by t.sort_order) from ${staffTherapies} st join ${therapies} t on t.id = st.therapy_id where st.staff_profile_id = ${qualified(staffProfiles.id)}), '{}')`;
const assignedCountSql = sql<number>`(select count(*)::int from ${patientStaff} ps where ps.staff_profile_id = ${qualified(staffProfiles.id)} and ps.unassigned_at is null)`;

/** Admin: all staff, including support staff without logins. */
export async function listStaff(actor: Actor, filter: { type?: StaffType; active?: boolean }): Promise<StaffRow[]> {
  if (scopeFor(actor, "read", "staffProfile") !== "all") throw new ForbiddenError();
  const conditions: (SQL | undefined)[] = [];
  if (filter.type) conditions.push(eq(staffProfiles.staffType, filter.type));
  if (filter.active === true) conditions.push(isNull(staffProfiles.archivedAt));
  if (filter.active === false) conditions.push(sql`${staffProfiles.archivedAt} is not null`);
  const rows = await getDb()
    .select({
      id: staffProfiles.id,
      fullName: staffProfiles.fullName,
      staffType: staffProfiles.staffType,
      title: staffProfiles.title,
      therapyNames: therapyNamesSql,
      isVerified: staffProfiles.isVerified,
      archivedAt: staffProfiles.archivedAt,
      userId: staffProfiles.userId,
      phone: staffProfiles.phone,
      joinedOn: staffProfiles.joinedOn,
      assignedPatients: assignedCountSql,
    })
    .from(staffProfiles)
    .where(and(...conditions))
    .orderBy(asc(staffProfiles.fullName));
  return rows.map(({ archivedAt, userId, ...r }) => ({ ...r, active: archivedAt === null, hasLogin: userId !== null }));
}

export type StaffDetail = StaffRow & {
  expertise: string[];
  experienceYears: number | null;
  therapySlugs: string[];
  email: string | null;
  bio: string | null;
  loginEmail: string | null;
  patients: { id: string; name: string; trackingId: string; assignedAt: string }[];
};

/** Admin, or the staff member viewing their own profile. */
export async function getStaff(actor: Actor, id: string): Promise<StaffDetail> {
  assertCan(actor, "read", { type: "staffProfile", staffProfileId: id });
  const db = getDb();
  const [row] = await db
    .select({
      id: staffProfiles.id,
      fullName: staffProfiles.fullName,
      staffType: staffProfiles.staffType,
      title: staffProfiles.title,
      therapyNames: therapyNamesSql,
      therapySlugs: therapySlugsSql,
      isVerified: staffProfiles.isVerified,
      archivedAt: staffProfiles.archivedAt,
      userId: staffProfiles.userId,
      phone: staffProfiles.phone,
      email: staffProfiles.email,
      joinedOn: staffProfiles.joinedOn,
      expertise: staffProfiles.expertise,
      experienceYears: staffProfiles.experienceYears,
      bio: staffProfiles.bio,
      loginEmail: users.email,
      assignedPatients: assignedCountSql,
    })
    .from(staffProfiles)
    .leftJoin(users, eq(users.id, staffProfiles.userId))
    .where(eq(staffProfiles.id, id))
    .limit(1);
  if (!row) throw new NotFoundError("This staff member does not exist.");
  const assigned = await db
    .select({ id: patients.id, name: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`, trackingId: patients.trackingId, assignedAt: patientStaff.assignedAt })
    .from(patientStaff)
    .innerJoin(patients, eq(patients.id, patientStaff.patientId))
    .where(and(eq(patientStaff.staffProfileId, id), isNull(patientStaff.unassignedAt), isNull(patients.deletedAt)))
    .orderBy(asc(patients.lastName));
  const { archivedAt, userId, ...rest } = row;
  return {
    ...rest,
    active: archivedAt === null,
    hasLogin: userId !== null,
    patients: assigned.map((p) => ({ ...p, assignedAt: p.assignedAt.toISOString() })),
  };
}

async function setTherapies(tx: Transaction, staffProfileId: string, slugs: string[]) {
  await tx.delete(staffTherapies).where(eq(staffTherapies.staffProfileId, staffProfileId));
  if (slugs.length === 0) return;
  const lines = await tx.select({ id: therapies.id }).from(therapies).where(inArray(therapies.slug, slugs));
  if (lines.length > 0) await tx.insert(staffTherapies).values(lines.map((l) => ({ staffProfileId, therapyId: l.id })));
}

const profileValues = (input: z.output<typeof updateStaffSchema> | z.output<typeof staffProfileSchema>) => ({
  fullName: input.fullName,
  staffType: input.staffType,
  title: input.title ?? null,
  expertise: input.expertise,
  experienceYears: input.experienceYears ?? null,
  phone: input.phone ?? null,
  email: input.email ?? null,
  joinedOn: input.joinedOn ?? null,
  bio: input.bio ?? null,
  isVerified: input.isVerified,
});

/** Admin: add a staff member, optionally with a login (never for support staff). */
export async function createStaff(actor: Actor, input: z.output<typeof staffProfileSchema>): Promise<{ id: string }> {
  if (scopeFor(actor, "create", "staffProfile") !== "all") throw new ForbiddenError();
  const login = input.createLogin && input.staffType !== "labour" && input.loginEmail && input.loginPassword
    ? { userId: randomUUID(), email: input.loginEmail, passwordHash: await hashPassword(input.loginPassword) }
    : null;
  return getDb().transaction(async (tx) => {
    if (login) await insertStaffLogin(tx, { userId: login.userId, name: input.fullName, email: login.email, passwordHash: login.passwordHash });
    const [row] = await tx
      .insert(staffProfiles)
      .values({ ...profileValues(input), userId: login?.userId ?? null })
      .returning({ id: staffProfiles.id });
    if (!row) throw new Error("Insert returned no row");
    await setTherapies(tx, row.id, input.therapySlugs);
    await writeAudit(tx, { actorUserId: actor.userId, action: "staff.create", entityType: "staff_profile", entityId: row.id, after: { ...profileValues(input), therapySlugs: input.therapySlugs, login: login ? login.email : null } });
    return row;
  });
}

export async function updateStaff(actor: Actor, input: z.output<typeof updateStaffSchema>): Promise<void> {
  // Staff may update parts of their own profile in a later phase; editing here is admin-only.
  if (scopeFor(actor, "update", "staffProfile") !== "all") throw new ForbiddenError();
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(staffProfiles).where(eq(staffProfiles.id, input.id)).for("update").limit(1);
    if (!before) throw new NotFoundError("This staff member does not exist.");
    const values = profileValues(input);
    if (before.userId && values.staffType === "labour") values.staffType = before.staffType; // people with logins stay clinical staff
    await tx.update(staffProfiles).set(values).where(eq(staffProfiles.id, input.id));
    await setTherapies(tx, input.id, input.therapySlugs);
    await writeAudit(tx, { actorUserId: actor.userId, action: "staff.update", entityType: "staff_profile", entityId: input.id, before, after: { ...values, therapySlugs: input.therapySlugs } });
  });
}

/**
 * Admin: deactivate (or reactivate). People are never hard-deleted because
 * sessions, attendance and audit history reference them. Deactivating also
 * closes their patient assignments and blocks their login.
 */
export async function setStaffActive(actor: Actor, input: z.output<typeof setStaffActiveSchema>): Promise<void> {
  if (scopeFor(actor, "update", "staffProfile") !== "all") throw new ForbiddenError();
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(staffProfiles).where(eq(staffProfiles.id, input.id)).for("update").limit(1);
    if (!before) throw new NotFoundError("This staff member does not exist.");
    if (before.userId === actor.userId && !input.active) throw new ConflictError("You cannot deactivate your own profile.");
    await tx.update(staffProfiles).set({ archivedAt: input.active ? null : new Date() }).where(eq(staffProfiles.id, input.id));
    if (!input.active) {
      await tx.update(patientStaff).set({ unassignedAt: new Date() }).where(and(eq(patientStaff.staffProfileId, input.id), isNull(patientStaff.unassignedAt)));
      if (before.userId) await tx.execute(sql`delete from sessions where user_id = ${before.userId}`);
    }
    await writeAudit(tx, { actorUserId: actor.userId, action: input.active ? "staff.reactivate" : "staff.deactivate", entityType: "staff_profile", entityId: input.id, before: { active: before.archivedAt === null }, after: { active: input.active } });
  });
}
