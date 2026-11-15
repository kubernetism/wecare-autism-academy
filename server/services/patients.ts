import "server-only";
import { qualified } from "@/db/qualified";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Transaction } from "@/db/create-db";
import { admissions, patients, patientStaff, staffProfiles, trackingCounters } from "@/db/schema";
import type { AdmissionKind, PatientStatus, Sex } from "@/db/schema/enums";
import { assertCan, type Actor } from "@/lib/permissions";
import { ymdInZone } from "@/lib/time";
import type {
  admitPatientSchema,
  cancelPatientSchema,
  patientListQuerySchema,
  readmitPatientSchema,
  updatePatientSchema,
} from "@/lib/validation/clinical";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { env } from "../env";
import { ConflictError, NotFoundError } from "../errors";
import { authorizePatient, patientReadFilter } from "./patient-access";

/** WCA-YYYY-NNNN: atomic per-year counter inside the caller's transaction. */
export async function issueTrackingId(tx: Transaction, year: number): Promise<string> {
  const [row] = await tx
    .insert(trackingCounters)
    .values({ year, lastValue: 1 })
    .onConflictDoUpdate({ target: trackingCounters.year, set: { lastValue: sql`${trackingCounters.lastValue} + 1` } })
    .returning({ value: trackingCounters.lastValue });
  if (!row) throw new Error("Could not issue a tracking ID");
  return formatTrackingId(year, row.value);
}

export function formatTrackingId(year: number, value: number): string {
  return `WCA-${year}-${String(value).padStart(4, "0")}`;
}

export type PatientListRow = {
  id: string;
  trackingId: string;
  name: string;
  dateOfBirth: string;
  status: PatientStatus;
  guardianName: string;
  guardianPhone: string;
  assignedStaff: string[];
};

const fullName = sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`;

export async function listPatients(
  actor: Actor,
  query: z.output<typeof patientListQuerySchema>,
): Promise<{ rows: PatientListRow[]; total: number }> {
  const scope = patientReadFilter(actor, sql`${patients.id}`);
  if (scope === null) return { rows: [], total: 0 };

  const conditions = [isNull(patients.deletedAt), scope];
  if (query.status) conditions.push(eq(patients.status, query.status));
  if (query.q) {
    const pattern = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(patients.trackingId, pattern), sql`${fullName} ilike ${pattern}`, ilike(patients.preferredName, pattern)));
  }
  const where = and(...conditions);
  const db = getDb();

  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(patients).where(where);
  const rows = await db
    .select({
      id: patients.id,
      trackingId: patients.trackingId,
      name: fullName,
      dateOfBirth: patients.dateOfBirth,
      status: patients.status,
      guardianName: patients.guardianName,
      guardianPhone: patients.guardianPhone,
      assignedStaff: sql<string[]>`coalesce((select array_agg(sp.full_name order by sp.full_name) from ${patientStaff} ps join ${staffProfiles} sp on sp.id = ps.staff_profile_id where ps.patient_id = ${qualified(patients.id)} and ps.unassigned_at is null), '{}')`,
    })
    .from(patients)
    .where(where)
    .orderBy(asc(patients.lastName), asc(patients.firstName))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { rows, total };
}

export type PatientDetail = {
  id: string;
  trackingId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string;
  sex: Sex;
  diagnosisSummary: string | null;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string | null;
  address: string | null;
  notes: string | null;
  status: PatientStatus;
  createdAt: string;
  assignments: { staffProfileId: string; fullName: string; title: string | null; assignedAt: string }[];
  admissions: { id: string; kind: AdmissionKind; effectiveOn: string; reason: string | null; details: Record<string, unknown> | null; createdAt: string }[];
};

export async function getPatient(actor: Actor, id: string): Promise<PatientDetail> {
  const db = getDb();
  await authorizePatient(db, actor, id, "read", (patient) => ({ type: "patient", patient }));
  const [row] = await db.select().from(patients).where(and(eq(patients.id, id), isNull(patients.deletedAt))).limit(1);
  if (!row) throw new NotFoundError("This patient record does not exist.");

  const assignments = await db
    .select({ staffProfileId: staffProfiles.id, fullName: staffProfiles.fullName, title: staffProfiles.title, assignedAt: patientStaff.assignedAt })
    .from(patientStaff)
    .innerJoin(staffProfiles, eq(staffProfiles.id, patientStaff.staffProfileId))
    .where(and(eq(patientStaff.patientId, id), isNull(patientStaff.unassignedAt)))
    .orderBy(asc(staffProfiles.fullName));
  const history = await db
    .select({ id: admissions.id, kind: admissions.kind, effectiveOn: admissions.effectiveOn, reason: admissions.reason, details: admissions.details, createdAt: admissions.createdAt })
    .from(admissions)
    .where(eq(admissions.patientId, id))
    .orderBy(desc(admissions.createdAt));

  return {
    id: row.id,
    trackingId: row.trackingId,
    firstName: row.firstName,
    lastName: row.lastName,
    preferredName: row.preferredName,
    dateOfBirth: row.dateOfBirth,
    sex: row.sex,
    diagnosisSummary: row.diagnosisSummary,
    guardianName: row.guardianName,
    guardianRelationship: row.guardianRelationship,
    guardianPhone: row.guardianPhone,
    guardianEmail: row.guardianEmail,
    address: row.address,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    assignments: assignments.map((a) => ({ ...a, assignedAt: a.assignedAt.toISOString() })),
    admissions: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
  };
}

/** The editable demographic fields; accepts validated input or a stored row. */
type PatientDetailsLike = {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dateOfBirth: string;
  sex: Sex;
  diagnosisSummary?: string | null;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  address?: string | null;
  notes?: string | null;
};

function detailsValues(input: PatientDetailsLike) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    preferredName: input.preferredName ?? null,
    dateOfBirth: input.dateOfBirth,
    sex: input.sex,
    diagnosisSummary: input.diagnosisSummary ?? null,
    guardianName: input.guardianName,
    guardianRelationship: input.guardianRelationship,
    guardianPhone: input.guardianPhone,
    guardianEmail: input.guardianEmail ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
  };
}

async function assertAssignableStaff(tx: Transaction, ids: string[]) {
  if (ids.length === 0) return;
  const rows = await tx
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(and(inArray(staffProfiles.id, ids), isNull(staffProfiles.archivedAt), ne(staffProfiles.staffType, "labour")));
  if (rows.length !== new Set(ids).size) throw new ConflictError("One of the selected staff members is not available for assignment.");
}

/** Admin: register and admit a new patient; issues the tracking ID. */
export async function admitPatient(actor: Actor, input: z.output<typeof admitPatientSchema>): Promise<{ id: string; trackingId: string }> {
  assertCan(actor, "create", { type: "patient", patient: { assignedStaffProfileIds: [], parentIds: [] } });
  const year = Number(ymdInZone(new Date(), env.CLINIC_TIME_ZONE).slice(0, 4));

  return getDb().transaction(async (tx) => {
    await assertAssignableStaff(tx, input.assignStaffIds);
    const trackingId = await issueTrackingId(tx, year);
    const [patient] = await tx
      .insert(patients)
      .values({ ...detailsValues(input), trackingId, status: "active", createdByUserId: actor.userId })
      .returning({ id: patients.id });
    if (!patient) throw new Error("Insert returned no row");
    await tx.insert(admissions).values({
      patientId: patient.id,
      kind: "admit",
      effectiveOn: input.admittedOn,
      reason: input.reason ?? null,
      actorUserId: actor.userId,
    });
    for (const staffProfileId of new Set(input.assignStaffIds)) {
      await tx.insert(patientStaff).values({ patientId: patient.id, staffProfileId, assignedByUserId: actor.userId });
    }
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "patient.admit",
      entityType: "patient",
      entityId: patient.id,
      after: { trackingId, ...detailsValues(input), admittedOn: input.admittedOn, assignStaffIds: input.assignStaffIds },
    });
    return { id: patient.id, trackingId };
  });
}

export async function updatePatient(actor: Actor, input: z.output<typeof updatePatientSchema>): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await authorizePatient(tx, actor, input.id, "update", (patient) => ({ type: "patient", patient }));
    const [before] = await tx.select().from(patients).where(eq(patients.id, input.id)).for("update").limit(1);
    if (!before) throw new NotFoundError("This patient record does not exist.");
    const values = detailsValues(input);
    await tx.update(patients).set(values).where(eq(patients.id, input.id));
    await writeAudit(tx, { actorUserId: actor.userId, action: "patient.update", entityType: "patient", entityId: input.id, before: detailsValues(before), after: values });
  });
}

async function changeStatus(
  actor: Actor,
  id: string,
  kind: Extract<AdmissionKind, "cancel" | "readmit">,
  effectiveOn: string,
  reason: string | null,
) {
  await getDb().transaction(async (tx) => {
    await authorizePatient(tx, actor, id, "create", (patient) => ({ type: "admission", patient }));
    const [current] = await tx.select({ status: patients.status }).from(patients).where(eq(patients.id, id)).for("update").limit(1);
    if (!current) throw new NotFoundError("This patient record does not exist.");
    const next: PatientStatus = kind === "cancel" ? "cancelled" : "active";
    if (kind === "cancel" && current.status !== "active") throw new ConflictError("Only an active patient can be cancelled.");
    if (kind === "readmit" && current.status === "active") throw new ConflictError("This patient is already active.");
    await tx.update(patients).set({ status: next }).where(eq(patients.id, id));
    await tx.insert(admissions).values({ patientId: id, kind, effectiveOn, reason, actorUserId: actor.userId });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: `patient.${kind}`,
      entityType: "patient",
      entityId: id,
      before: { status: current.status },
      after: { status: next, effectiveOn, reason },
    });
  });
}

export async function cancelPatient(actor: Actor, input: z.output<typeof cancelPatientSchema>) {
  return changeStatus(actor, input.id, "cancel", input.effectiveOn, input.reason);
}

export async function readmitPatient(actor: Actor, input: z.output<typeof readmitPatientSchema>) {
  return changeStatus(actor, input.id, "readmit", input.effectiveOn, input.reason ?? null);
}

/** Admin: assign a doctor or specialist to a patient (idempotent). */
export async function assignStaff(actor: Actor, patientId: string, staffProfileId: string, tx?: Transaction): Promise<void> {
  assertCan(actor, "create", { type: "patientAssignment" });
  const run = async (t: Transaction) => {
    const [exists] = await t.select({ id: patients.id }).from(patients).where(and(eq(patients.id, patientId), isNull(patients.deletedAt))).limit(1);
    if (!exists) throw new NotFoundError("This patient record does not exist.");
    await assertAssignableStaff(t, [staffProfileId]);
    const inserted = await t
      .insert(patientStaff)
      .values({ patientId, staffProfileId, assignedByUserId: actor.userId })
      .onConflictDoNothing()
      .returning({ id: patientStaff.id });
    if (inserted.length > 0) {
      await writeAudit(t, { actorUserId: actor.userId, action: "patient.assign_staff", entityType: "patient", entityId: patientId, after: { staffProfileId } });
    }
  };
  if (tx) return run(tx);
  return getDb().transaction(run);
}

export async function unassignStaff(actor: Actor, patientId: string, staffProfileId: string): Promise<void> {
  assertCan(actor, "delete", { type: "patientAssignment" });
  await getDb().transaction(async (tx) => {
    const closed = await tx
      .update(patientStaff)
      .set({ unassignedAt: new Date() })
      .where(and(eq(patientStaff.patientId, patientId), eq(patientStaff.staffProfileId, staffProfileId), isNull(patientStaff.unassignedAt)))
      .returning({ id: patientStaff.id });
    if (closed.length === 0) throw new NotFoundError("This staff member is not assigned to the patient.");
    await writeAudit(tx, { actorUserId: actor.userId, action: "patient.unassign_staff", entityType: "patient", entityId: patientId, before: { staffProfileId } });
  });
}

/** Header search: patients by name or tracking ID within the actor's scope. */
export async function searchPatients(actor: Actor, q: string): Promise<PatientListRow[]> {
  const { rows } = await listPatients(actor, { q, page: 1, pageSize: 25 });
  return rows;
}

/** Small option lists for forms (admin). */
export async function patientOptions(actor: Actor): Promise<{ id: string; label: string }[]> {
  const { rows } = await listPatients(actor, { status: "active", page: 1, pageSize: 100 });
  return rows.map((r) => ({ id: r.id, label: `${r.name} (${r.trackingId})` }));
}
