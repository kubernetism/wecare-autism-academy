import "server-only";
import { qualified } from "@/db/qualified";
import { desc, sql } from "drizzle-orm";
import { auditLog } from "@/db/schema";
import type { Actor } from "@/lib/permissions";
import { getDb } from "../db";
import { authorizePatient } from "./patient-access";

export type AuditRow = { id: number; action: string; entityType: string; actor: string | null; createdAt: string };

/**
 * Everything recorded about one patient: the patient row and its sessions,
 * enrollments, goals and clinical records. Readable by whoever can read the
 * patient. Before/after values stay in the database (not sent to the page).
 */
export async function patientAuditTrail(actor: Actor, patientId: string, limit = 100): Promise<AuditRow[]> {
  const db = getDb();
  await authorizePatient(db, actor, patientId, "read", (patient) => ({ type: "patient", patient }));
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      actor: sql<string | null>`(select name from users u where u.id = ${qualified(auditLog.actorUserId)})`,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(
      sql`(${auditLog.entityType} = 'patient' and ${auditLog.entityId} = ${patientId})
        or (${auditLog.entityType} = 'therapy_session' and ${auditLog.entityId} in (select id::text from therapy_sessions where patient_id = ${patientId}))
        or (${auditLog.entityType} = 'enrollment' and ${auditLog.entityId} in (select id::text from enrollments where patient_id = ${patientId}))
        or (${auditLog.entityType} = 'goal' and ${auditLog.entityId} in (select id::text from goals where patient_id = ${patientId}))
        or (${auditLog.entityType} = 'clinical_record' and ${auditLog.entityId} in (select id::text from clinical_records where patient_id = ${patientId}))`,
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
