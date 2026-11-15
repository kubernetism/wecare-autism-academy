import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import type { Transaction } from "@/db/create-db";
import { clinicalRecords, enrollments, recordAmendments, therapies } from "@/db/schema";
import type { LifecycleStage, RecordStatus } from "@/db/schema/enums";
import { can, type Actor } from "@/lib/permissions";
import type { TemplateAnswers } from "@/lib/templates/types";
import { answersSchema } from "@/lib/templates/validate";
import type { amendStageRecordSchema, createStageRecordSchema, saveStageRecordSchema } from "@/lib/validation/clinical";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { authorizePatient, loadPatientScope } from "./patient-access";
import { currentTemplate, templateById, type TemplateRef } from "./templates";

type Kind = Extract<LifecycleStage, "intake" | "assessment" | "plan" | "progress_review" | "discharge">;

function issuesToFields(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (key && !(key in out)) out[key] = i.message;
  }
  return out;
}

/** Staff (assigned) or admin: start a draft stage record using the current template version. */
export async function createStageRecord(actor: Actor, input: z.output<typeof createStageRecordSchema>): Promise<{ id: string }> {
  return getDb().transaction(async (tx) => {
    const [enrollment] = await tx.select({ patientId: enrollments.patientId, therapyId: enrollments.therapyId }).from(enrollments).where(eq(enrollments.id, input.enrollmentId)).limit(1);
    if (!enrollment) throw new NotFoundError("This enrollment does not exist.");
    const kind = input.stage as Kind;
    await authorizePatient(tx, actor, enrollment.patientId, "create", (patient) => ({ type: "clinicalRecord", kind, patient }));
    const template = await currentTemplate(tx, enrollment.therapyId, input.stage);
    const [row] = await tx
      .insert(clinicalRecords)
      .values({
        enrollmentId: input.enrollmentId,
        patientId: enrollment.patientId,
        stage: input.stage,
        templateId: template.id,
        templateVersion: template.version,
        authorStaffId: actor.staffProfileId,
      })
      .returning({ id: clinicalRecords.id });
    if (!row) throw new Error("Insert returned no row");
    await writeAudit(tx, { actorUserId: actor.userId, action: "clinical_record.create", entityType: "clinical_record", entityId: row.id, after: { stage: input.stage, templateVersion: template.version } });
    return row;
  });
}

async function lockRecord(tx: Transaction, id: string) {
  const [row] = await tx.select().from(clinicalRecords).where(and(eq(clinicalRecords.id, id), isNull(clinicalRecords.deletedAt))).for("update").limit(1);
  if (!row) throw new NotFoundError("This record does not exist.");
  return row;
}

export type StageRecordView = {
  id: string;
  enrollmentId: string;
  patientId: string;
  therapyName: string;
  stage: LifecycleStage;
  status: RecordStatus;
  template: TemplateRef;
  original: TemplateAnswers;
  current: TemplateAnswers;
  signedAt: string | null;
  amendments: { version: number; reason: string; createdAt: string }[];
  canEdit: boolean;
};

export async function getStageRecord(actor: Actor, id: string): Promise<StageRecordView> {
  const db = getDb();
  const [row] = await db
    .select({ record: clinicalRecords, therapyName: therapies.name })
    .from(clinicalRecords)
    .innerJoin(enrollments, eq(enrollments.id, clinicalRecords.enrollmentId))
    .innerJoin(therapies, eq(therapies.id, enrollments.therapyId))
    .where(and(eq(clinicalRecords.id, id), isNull(clinicalRecords.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("This record does not exist.");
  const r = row.record;
  const kind = r.stage as Kind;
  await authorizePatient(db, actor, r.patientId, "read", (patient) => ({ type: "clinicalRecord", kind, patient }));
  const amendments = await db
    .select({ version: recordAmendments.version, reason: recordAmendments.reason, createdAt: recordAmendments.createdAt, snapshot: recordAmendments.snapshot })
    .from(recordAmendments)
    .where(and(eq(recordAmendments.recordType, "clinical_record"), eq(recordAmendments.recordId, id)))
    .orderBy(asc(recordAmendments.version));
  const scope = await loadPatientScope(db, r.patientId);
  return {
    id: r.id,
    enrollmentId: r.enrollmentId,
    patientId: r.patientId,
    therapyName: row.therapyName,
    stage: r.stage,
    status: r.status,
    template: await templateById(db, r.templateId),
    original: r.answers,
    current: (amendments.at(-1)?.snapshot as TemplateAnswers | undefined) ?? r.answers,
    signedAt: r.signedAt?.toISOString() ?? null,
    amendments: amendments.map((a) => ({ version: a.version, reason: a.reason, createdAt: a.createdAt.toISOString() })),
    canEdit: scope !== null && can(actor, "update", { type: "clinicalRecord", kind, patient: scope }),
  };
}

export async function saveStageRecord(actor: Actor, input: z.output<typeof saveStageRecordSchema>, sign: boolean): Promise<{ fieldErrors?: Record<string, string> }> {
  return getDb().transaction(async (tx) => {
    const current = await lockRecord(tx, input.id);
    const kind = current.stage as Kind;
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "clinicalRecord", kind, patient }));
    if (current.status === "signed") throw new ConflictError("This record is signed and locked. Use an amendment to change it.");
    const template = await templateById(tx, current.templateId);
    const parsed = answersSchema(template.schema, sign ? "final" : "draft").safeParse(input.answers);
    if (!parsed.success) return { fieldErrors: issuesToFields(parsed.error.issues) };
    const now = new Date();
    await tx
      .update(clinicalRecords)
      .set({ answers: parsed.data, ...(sign ? { status: "signed" as const, signedAt: now, signedByUserId: actor.userId } : {}) })
      .where(eq(clinicalRecords.id, current.id));
    await writeAudit(tx, { actorUserId: actor.userId, action: sign ? "clinical_record.sign" : "clinical_record.save", entityType: "clinical_record", entityId: current.id, before: current.answers, after: parsed.data });
    return {};
  });
}

export async function amendStageRecord(actor: Actor, input: z.output<typeof amendStageRecordSchema>): Promise<{ fieldErrors?: Record<string, string> }> {
  return getDb().transaction(async (tx) => {
    const current = await lockRecord(tx, input.id);
    const kind = current.stage as Kind;
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "clinicalRecord", kind, patient }));
    if (current.status !== "signed") throw new ConflictError("Only a signed record can be amended.");
    const template = await templateById(tx, current.templateId);
    const parsed = answersSchema(template.schema, "final").safeParse(input.answers);
    if (!parsed.success) return { fieldErrors: issuesToFields(parsed.error.issues) };
    const [latest] = await tx
      .select({ version: recordAmendments.version })
      .from(recordAmendments)
      .where(and(eq(recordAmendments.recordType, "clinical_record"), eq(recordAmendments.recordId, current.id)))
      .orderBy(desc(recordAmendments.version))
      .limit(1);
    const version = (latest?.version ?? 0) + 1;
    await tx.insert(recordAmendments).values({ recordType: "clinical_record", recordId: current.id, version, snapshot: parsed.data, reason: input.reason, amendedByUserId: actor.userId });
    await writeAudit(tx, { actorUserId: actor.userId, action: "clinical_record.amend", entityType: "clinical_record", entityId: current.id, after: { version, reason: input.reason, answers: parsed.data } });
    return {};
  });
}
