import "server-only";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Database, Transaction } from "@/db/create-db";
import { patients, patientStaff } from "@/db/schema";
import { assertCan, scopeFor, type Action, type Actor, type PatientScope, type Resource } from "@/lib/permissions";
import { NotFoundError } from "../errors";

type Db = Database | Transaction;

/** Assigned staff (open assignments). Parent links arrive in Phase 3. */
export async function loadPatientScope(db: Db, patientId: string): Promise<PatientScope | null> {
  const [exists] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), isNull(patients.deletedAt)))
    .limit(1);
  if (!exists) return null;
  const rows = await db
    .select({ staffProfileId: patientStaff.staffProfileId })
    .from(patientStaff)
    .where(and(eq(patientStaff.patientId, patientId), isNull(patientStaff.unassignedAt)));
  return { assignedStaffProfileIds: rows.map((r) => r.staffProfileId), parentIds: [] };
}

type PatientResource = Extract<Resource, { patient: PatientScope }>;

/**
 * Loads the patient's scope and checks `can()` for the given resource shape.
 * A missing (or soft-deleted) patient and a forbidden one both read as
 * "not found" to staff, so unassigned staff cannot probe which IDs exist.
 */
export async function authorizePatient(
  db: Db,
  actor: Actor,
  patientId: string,
  action: Action,
  build: (patient: PatientScope) => PatientResource,
): Promise<PatientScope> {
  const scope = await loadPatientScope(db, patientId);
  if (!scope) throw new NotFoundError("This patient record does not exist.");
  const resource = build(scope);
  if (actor.role !== "admin" && scopeFor(actor, action, resource.type) === "own") {
    // Hide existence of patients the staff member cannot see.
    try {
      assertCan(actor, action, resource);
    } catch {
      throw new NotFoundError("This patient record does not exist.");
    }
    return scope;
  }
  assertCan(actor, action, resource);
  return scope;
}

/**
 * SQL filter limiting a patient-keyed query to what the actor may read:
 * everything for admins, open assignments for staff, nothing otherwise.
 * Returns `null` when the actor may see nothing.
 */
export function patientReadFilter(actor: Actor, patientIdColumn: SQL | ReturnType<typeof sql>): SQL | undefined | null {
  const scope = scopeFor(actor, "read", "patient");
  if (scope === "all") return undefined;
  if (scope === "own" && actor.role === "staff" && actor.staffProfileId) {
    return sql`exists (select 1 from ${patientStaff} ps where ps.patient_id = ${patientIdColumn} and ps.staff_profile_id = ${actor.staffProfileId} and ps.unassigned_at is null)`;
  }
  return null;
}
