import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Transaction } from "@/db/create-db";
import { unstable_cache } from "next/cache";
import { accounts, staffProfiles, staffTherapies, therapies, users } from "@/db/schema";
import type { StaffType, UserRole } from "@/db/schema/enums";
import { assertCan, scopeFor, type Actor } from "@/lib/permissions";
import type { z } from "zod";
import type { createStaffAccountSchema } from "@/lib/validation/clinic";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { isDatabaseConfigured } from "../env";
import { ConflictError } from "../errors";

export const TEAM_TAG = "team";

export type StaffAccountRow = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  staffType: StaffType | null;
  title: string | null;
  therapyNames: string[];
  createdAt: string;
};

/** Admin view: every login that belongs to the clinic (admin + staff). */
export async function listStaffAccounts(actor: Actor): Promise<StaffAccountRow[]> {
  assertCan(actor, "read", { type: "user" });
  const rows = await getDb()
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      staffType: staffProfiles.staffType,
      title: staffProfiles.title,
      createdAt: users.createdAt,
      therapyNames: sql<string[]>`coalesce(array_agg(${therapies.shortName} order by ${therapies.sortOrder}) filter (where ${therapies.id} is not null), '{}')`,
    })
    .from(users)
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .leftJoin(staffTherapies, eq(staffTherapies.staffProfileId, staffProfiles.id))
    .leftJoin(therapies, eq(therapies.id, staffTherapies.therapyId))
    .where(inArray(users.role, ["admin", "staff"]))
    .groupBy(users.id, staffProfiles.id)
    .orderBy(asc(users.name));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/**
 * Admin creates a staff login plus its staff profile in one transaction.
 * Written directly (not through Better Auth's sign-up) so the admin's own
 * session is untouched and the role can be set server-side.
 */
export async function createStaffAccount(
  actor: Actor,
  input: z.output<typeof createStaffAccountSchema>,
): Promise<{ userId: string }> {
  assertCan(actor, "create", { type: "user" });
  const passwordHash = await hashPassword(input.password);
  const userId = randomUUID();

  await getDb().transaction(async (tx) => {
    await insertStaffLogin(tx, { userId, name: input.name, email: input.email, passwordHash });
    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        userId,
        fullName: input.name,
        staffType: input.staffType,
        title: input.title ?? null,
      })
      .returning({ id: staffProfiles.id });
    if (!profile) throw new Error("Insert returned no row");

    if (input.therapySlugs.length > 0) {
      const lines = await tx
        .select({ id: therapies.id })
        .from(therapies)
        .where(inArray(therapies.slug, input.therapySlugs));
      if (lines.length > 0) {
        await tx
          .insert(staffTherapies)
          .values(lines.map((l) => ({ staffProfileId: profile.id, therapyId: l.id })));
      }
    }

    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "staff_account.create",
      entityType: "user",
      entityId: userId,
      after: {
        name: input.name,
        email: input.email,
        role: "staff",
        staffType: input.staffType,
        title: input.title ?? null,
        therapySlugs: input.therapySlugs,
      },
    });
  });

  return { userId };
}

/**
 * Creates a staff login (users + credential account) inside the caller's
 * transaction. Written directly, not through Better Auth's sign-up, so the
 * admin's own session is untouched and the role is set server-side.
 */
export async function insertStaffLogin(
  tx: Transaction,
  login: { userId: string; name: string; email: string; passwordHash: string },
): Promise<void> {
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, login.email)).limit(1);
  if (existing) throw new ConflictError("An account with this email already exists.");
  await tx.insert(users).values({ id: login.userId, name: login.name, email: login.email, emailVerified: false, role: "staff" });
  await tx.insert(accounts).values({ id: randomUUID(), userId: login.userId, accountId: login.userId, providerId: "credential", password: login.passwordHash });
}

export type PublicTeamMember = {
  id: string;
  fullName: string;
  title: string | null;
  bio: string | null;
  expertise: string[];
  therapyNames: string[];
};

/** Verified, active doctors and specialists for the website Team page. */
export const listPublicTeam = unstable_cache(
  async (): Promise<PublicTeamMember[]> => {
    if (!isDatabaseConfigured()) return [];
    return getDb()
      .select({
        id: staffProfiles.id,
        fullName: staffProfiles.fullName,
        title: staffProfiles.title,
        bio: staffProfiles.bio,
        expertise: staffProfiles.expertise,
        therapyNames: sql<string[]>`coalesce(array_agg(${therapies.shortName} order by ${therapies.sortOrder}) filter (where ${therapies.id} is not null), '{}')`,
      })
      .from(staffProfiles)
      .leftJoin(staffTherapies, eq(staffTherapies.staffProfileId, staffProfiles.id))
      .leftJoin(therapies, eq(therapies.id, staffTherapies.therapyId))
      .where(
        and(
          eq(staffProfiles.isVerified, true),
          ne(staffProfiles.staffType, "labour"),
          isNull(staffProfiles.archivedAt),
        ),
      )
      .groupBy(staffProfiles.id)
      .orderBy(asc(staffProfiles.fullName));
  },
  ["public-team"],
  { tags: [TEAM_TAG], revalidate: 3600 },
);

/** Count of active staff records, or null when the actor may not see staff. */
export async function countActiveStaff(actor: Actor): Promise<number | null> {
  if (scopeFor(actor, "read", "staffProfile") !== "all") return null;
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(staffProfiles)
    .where(isNull(staffProfiles.archivedAt));
  return row?.n ?? 0;
}
