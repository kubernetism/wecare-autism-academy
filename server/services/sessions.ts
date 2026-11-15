import "server-only";
import { qualified } from "@/db/qualified";
import { and, asc, count, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { Transaction } from "@/db/create-db";
import { attendancePatient, enrollments, patients, recordAmendments, staffProfiles, therapies, therapySessions } from "@/db/schema";
import type { LifecycleStage, PatientAttendance, RecordStatus, SessionOutcome, SessionStatus } from "@/db/schema/enums";
import { can, scopeFor, type Actor } from "@/lib/permissions";
import { answersSchema } from "@/lib/templates/validate";
import type { TemplateAnswers } from "@/lib/templates/types";
import {
  WIZARD_STEPS,
  type amendSessionSchema,
  type cancelSessionSchema,
  type rescheduleSessionSchema,
  type saveSessionStepSchema,
  type scheduleSessionSchema,
  type signOffSessionSchema,
  type WizardStep,
} from "@/lib/validation/clinical";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { authorizePatient, loadPatientScope } from "./patient-access";
import { assertSlotFree } from "./scheduling";
import { currentTemplate, templateById, type TemplateRef } from "./templates";

const STEP_STAGE: Record<WizardStep, LifecycleStage> = { history: "intake", assessment: "assessment", notes: "session_note" };
const STEP_COLUMN = { history: "historyAnswers", assessment: "assessmentAnswers", notes: "noteAnswers" } as const;

async function assertTherapist(tx: Transaction, staffProfileId: string) {
  const [staff] = await tx
    .select({ id: staffProfiles.id, type: staffProfiles.staffType, archivedAt: staffProfiles.archivedAt })
    .from(staffProfiles)
    .where(eq(staffProfiles.id, staffProfileId))
    .limit(1);
  if (!staff || staff.archivedAt || staff.type === "labour") throw new ConflictError("The selected therapist is not available.");
}

/** Admin: schedule one session, or the same slot weekly for N weeks (all or nothing). */
export async function scheduleSessions(actor: Actor, input: z.output<typeof scheduleSessionSchema>): Promise<{ ids: string[] }> {
  return getDb().transaction(async (tx) => {
    const [enrollment] = await tx
      .select({ patientId: enrollments.patientId, status: enrollments.status })
      .from(enrollments)
      .where(eq(enrollments.id, input.enrollmentId))
      .limit(1);
    if (!enrollment) throw new NotFoundError("This enrollment does not exist.");
    await authorizePatient(tx, actor, enrollment.patientId, "create", (patient) => ({ type: "therapySession", patient, staffProfileId: input.staffProfileId }));
    if (enrollment.status !== "active") throw new ConflictError("Sessions can only be scheduled for an active enrollment.");
    await assertTherapist(tx, input.staffProfileId);

    const ids: string[] = [];
    const first = new Date(input.start);
    for (let week = 0; week < input.repeatWeeks; week++) {
      const start = new Date(first.getTime() + week * 7 * 86_400_000);
      const end = new Date(start.getTime() + input.durationMinutes * 60_000);
      await assertSlotFree(tx, { staffProfileId: input.staffProfileId, patientId: enrollment.patientId, start, end });
      const [row] = await tx
        .insert(therapySessions)
        .values({
          enrollmentId: input.enrollmentId,
          patientId: enrollment.patientId,
          staffProfileId: input.staffProfileId,
          scheduledStart: start,
          scheduledEnd: end,
          createdByUserId: actor.userId,
        })
        .returning({ id: therapySessions.id });
      if (!row) throw new Error("Insert returned no row");
      ids.push(row.id);
    }
    await writeAudit(tx, { actorUserId: actor.userId, action: "session.schedule", entityType: "enrollment", entityId: input.enrollmentId, after: { ...input, sessionIds: ids } });
    return { ids };
  });
}

async function therapyOf(db: Parameters<typeof currentTemplate>[0], enrollmentId: string): Promise<string> {
  const [row] = await db.select({ therapyId: enrollments.therapyId }).from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
  if (!row) throw new NotFoundError("This enrollment does not exist.");
  return row.therapyId;
}

async function lockSession(tx: Transaction, id: string) {
  const [row] = await tx.select().from(therapySessions).where(and(eq(therapySessions.id, id), isNull(therapySessions.deletedAt))).for("update").limit(1);
  if (!row) throw new NotFoundError("This session does not exist.");
  return row;
}

export async function rescheduleSession(actor: Actor, input: z.output<typeof rescheduleSessionSchema>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const current = await lockSession(tx, input.id);
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "therapySession", patient, staffProfileId: current.staffProfileId }));
    if (current.status !== "scheduled") throw new ConflictError("Only a scheduled session can be moved.");
    await assertTherapist(tx, input.staffProfileId);
    const start = new Date(input.start);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    await assertSlotFree(tx, { staffProfileId: input.staffProfileId, patientId: current.patientId, start, end, excludeSessionId: current.id });
    await tx.update(therapySessions).set({ scheduledStart: start, scheduledEnd: end, staffProfileId: input.staffProfileId }).where(eq(therapySessions.id, current.id));
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "session.reschedule",
      entityType: "therapy_session",
      entityId: current.id,
      before: { start: current.scheduledStart, end: current.scheduledEnd, staffProfileId: current.staffProfileId },
      after: { start, end, staffProfileId: input.staffProfileId },
    });
  });
}

export async function cancelSession(actor: Actor, input: z.output<typeof cancelSessionSchema>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const current = await lockSession(tx, input.id);
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "therapySession", patient, staffProfileId: current.staffProfileId }));
    if (current.status !== "scheduled") throw new ConflictError("Only a scheduled session can be cancelled.");
    await tx.update(therapySessions).set({ status: "cancelled" }).where(eq(therapySessions.id, current.id));
    await tx
      .insert(attendancePatient)
      .values({ sessionId: current.id, patientId: current.patientId, status: "cancelled", reason: input.reason, markedByUserId: actor.userId })
      .onConflictDoUpdate({ target: attendancePatient.sessionId, set: { status: "cancelled", reason: input.reason, markedByUserId: actor.userId, markedAt: new Date() } });
    await writeAudit(tx, { actorUserId: actor.userId, action: "session.cancel", entityType: "therapy_session", entityId: current.id, before: { status: current.status }, after: { status: "cancelled", reason: input.reason } });
  });
}

/* ---------- Listing ---------- */

export type SessionRow = {
  id: string;
  patientId: string;
  patientName: string;
  trackingId: string;
  therapyName: string;
  staffProfileId: string;
  staffName: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: SessionStatus;
  recordStatus: RecordStatus;
  attendance: PatientAttendance | null;
  attendanceReason: string | null;
};

/** Read filter: admins see all; staff see sessions they run or of patients assigned to them. */
function sessionReadFilter(actor: Actor): SQL | undefined | null {
  const scope = scopeFor(actor, "read", "therapySession");
  if (scope === "all") return undefined;
  if (scope === "own" && actor.staffProfileId) {
    return sql`(${therapySessions.staffProfileId} = ${actor.staffProfileId} or exists (select 1 from patient_staff ps where ps.patient_id = ${therapySessions.patientId} and ps.staff_profile_id = ${actor.staffProfileId} and ps.unassigned_at is null))`;
  }
  return null;
}

function baseSessionQuery() {
  return getDb()
    .select({
      id: therapySessions.id,
      patientId: therapySessions.patientId,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      trackingId: patients.trackingId,
      therapyName: therapies.name,
      staffProfileId: therapySessions.staffProfileId,
      staffName: staffProfiles.fullName,
      scheduledStart: therapySessions.scheduledStart,
      scheduledEnd: therapySessions.scheduledEnd,
      status: therapySessions.status,
      recordStatus: therapySessions.recordStatus,
      attendance: attendancePatient.status,
      attendanceReason: attendancePatient.reason,
    })
    .from(therapySessions)
    .innerJoin(patients, eq(patients.id, therapySessions.patientId))
    .innerJoin(enrollments, eq(enrollments.id, therapySessions.enrollmentId))
    .innerJoin(therapies, eq(therapies.id, enrollments.therapyId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, therapySessions.staffProfileId))
    .leftJoin(attendancePatient, eq(attendancePatient.sessionId, therapySessions.id))
    .$dynamic();
}

type Raw = Awaited<ReturnType<typeof baseSessionQuery>>[number];
const toRow = (r: Raw): SessionRow => ({ ...r, scheduledStart: r.scheduledStart.toISOString(), scheduledEnd: r.scheduledEnd.toISOString() });

export type SessionQuery = {
  patientId?: string;
  staffProfileId?: string;
  from?: Date;
  to?: Date;
  status?: SessionStatus;
  page?: number;
  pageSize?: number;
  order?: "asc" | "desc";
};

export async function listSessions(actor: Actor, q: SessionQuery): Promise<{ rows: SessionRow[]; total: number }> {
  const filter = sessionReadFilter(actor);
  if (filter === null) return { rows: [], total: 0 };
  const conditions: (SQL | undefined)[] = [isNull(therapySessions.deletedAt), filter];
  if (q.patientId) conditions.push(eq(therapySessions.patientId, q.patientId));
  if (q.staffProfileId) conditions.push(eq(therapySessions.staffProfileId, q.staffProfileId));
  if (q.from) conditions.push(gte(therapySessions.scheduledStart, q.from));
  if (q.to) conditions.push(lt(therapySessions.scheduledStart, q.to));
  if (q.status) conditions.push(eq(therapySessions.status, q.status));
  const where = and(...conditions);
  const pageSize = q.pageSize ?? 20;
  const page = q.page ?? 1;
  const [{ total } = { total: 0 }] = await getDb().select({ total: count() }).from(therapySessions).where(where);
  const rows = await baseSessionQuery()
    .where(where)
    .orderBy(q.order === "desc" ? desc(therapySessions.scheduledStart) : asc(therapySessions.scheduledStart))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows: rows.map(toRow), total };
}

/* ---------- Session record wizard ---------- */

export type SessionRecordContent = {
  historyAnswers: TemplateAnswers;
  assessmentAnswers: TemplateAnswers;
  noteAnswers: TemplateAnswers;
  doctorNote: string | null;
  outcome: SessionOutcome | null;
};

export type SessionWizardData = {
  session: SessionRow & { enrollmentId: string; therapyId: string; signedAt: string | null };
  templates: Record<WizardStep, TemplateRef>;
  original: SessionRecordContent;
  current: SessionRecordContent;
  amendments: { version: number; reason: string; createdAt: string; amendedBy: string | null }[];
  canEdit: boolean;
};

async function stepTemplates(tx: Parameters<typeof currentTemplate>[0], therapyId: string, refs: Record<string, { templateId: string; version: number }>) {
  const entries = await Promise.all(
    WIZARD_STEPS.map(async (step) => [step, refs[step] ? await templateById(tx, refs[step].templateId) : await currentTemplate(tx, therapyId, STEP_STAGE[step])] as const),
  );
  return Object.fromEntries(entries) as Record<WizardStep, TemplateRef>;
}

export async function getSessionWizard(actor: Actor, sessionId: string): Promise<SessionWizardData> {
  const db = getDb();
  const [row] = await db.select().from(therapySessions).where(and(eq(therapySessions.id, sessionId), isNull(therapySessions.deletedAt))).limit(1);
  if (!row) throw new NotFoundError("This session does not exist.");
  await authorizePatient(db, actor, row.patientId, "read", (patient) => ({ type: "sessionRecord", patient, staffProfileId: row.staffProfileId }));
  const [listed] = await baseSessionQuery().where(eq(therapySessions.id, sessionId)).limit(1);
  if (!listed) throw new NotFoundError("This session does not exist.");
  const therapyId = await therapyOf(db, row.enrollmentId);
  const templates = await stepTemplates(db, therapyId, row.templateRefs);
  const amendments = await db
    .select({ version: recordAmendments.version, reason: recordAmendments.reason, createdAt: recordAmendments.createdAt, snapshot: recordAmendments.snapshot, amendedBy: sql<string | null>`(select name from users u where u.id = ${qualified(recordAmendments.amendedByUserId)})` })
    .from(recordAmendments)
    .where(and(eq(recordAmendments.recordType, "therapy_session"), eq(recordAmendments.recordId, sessionId)))
    .orderBy(asc(recordAmendments.version));
  const original: SessionRecordContent = {
    historyAnswers: row.historyAnswers,
    assessmentAnswers: row.assessmentAnswers,
    noteAnswers: row.noteAnswers,
    doctorNote: row.doctorNote,
    outcome: row.outcome,
  };
  const latest = amendments.at(-1);
  const scope = await loadPatientScope(db, row.patientId);
  const canEdit =
    scope !== null &&
    row.status !== "cancelled" &&
    can(actor, "update", { type: "sessionRecord", patient: scope, staffProfileId: row.staffProfileId });
  return {
    session: { ...toRow(listed), enrollmentId: row.enrollmentId, therapyId, signedAt: row.signedAt?.toISOString() ?? null },
    templates,
    original,
    current: latest ? (latest.snapshot as SessionRecordContent) : original,
    amendments: amendments.map((a) => ({ version: a.version, reason: a.reason, createdAt: a.createdAt.toISOString(), amendedBy: a.amendedBy })),
    canEdit,
  };
}

/** Save one wizard step as a draft. Signed records are locked. */
export async function saveSessionStep(actor: Actor, input: z.output<typeof saveSessionStepSchema>): Promise<{ fieldErrors?: Record<string, string> }> {
  return getDb().transaction(async (tx) => {
    const current = await lockSession(tx, input.sessionId);
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "sessionRecord", patient, staffProfileId: current.staffProfileId }));
    if (current.recordStatus === "signed") throw new ConflictError("This record is signed and locked. Use an amendment to change it.");
    if (current.status === "cancelled") throw new ConflictError("This session was cancelled.");
    const pinnedRef = current.templateRefs[input.step];
    const template = pinnedRef
      ? await templateById(tx, pinnedRef.templateId)
      : await currentTemplate(tx, await therapyOf(tx, current.enrollmentId), STEP_STAGE[input.step]);
    const parsed = answersSchema(template.schema, "draft").safeParse(input.answers);
    if (!parsed.success) return { fieldErrors: issuesToFields(parsed.error.issues) };
    const before = current[STEP_COLUMN[input.step]];
    await tx
      .update(therapySessions)
      .set({
        [STEP_COLUMN[input.step]]: parsed.data,
        recordStatus: "draft",
        templateRefs: { ...current.templateRefs, [input.step]: { templateId: template.id, version: template.version } },
      })
      .where(eq(therapySessions.id, current.id));
    await writeAudit(tx, { actorUserId: actor.userId, action: `session_record.save_${input.step}`, entityType: "therapy_session", entityId: current.id, before, after: parsed.data });
    return {};
  });
}

function issuesToFields(issues: readonly { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (key && !(key in out)) out[key] = i.message;
  }
  return out;
}

/** Validates every step against its pinned template in final mode. */
async function validateComplete(tx: Transaction, therapyId: string, refs: Record<string, { templateId: string; version: number }>, content: SessionRecordContent) {
  const templates = await stepTemplates(tx, therapyId, refs);
  const errors: Record<string, Record<string, string>> = {};
  const clean: Partial<SessionRecordContent> = {};
  for (const step of WIZARD_STEPS) {
    const result = answersSchema(templates[step].schema, "final").safeParse(content[STEP_COLUMN[step]]);
    if (!result.success) errors[step] = issuesToFields(result.error.issues);
    else clean[STEP_COLUMN[step]] = result.data;
  }
  const pinned = Object.fromEntries(WIZARD_STEPS.map((s) => [s, { templateId: templates[s].id, version: templates[s].version }]));
  return { errors, clean, pinned };
}

export type SignOffResult = { stepErrors?: Record<string, Record<string, string>> };

/** Sign off: all steps must be complete. Locks the record. */
export async function signOffSession(actor: Actor, input: z.output<typeof signOffSessionSchema>): Promise<SignOffResult> {
  return getDb().transaction(async (tx) => {
    const current = await lockSession(tx, input.sessionId);
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "sessionRecord", patient, staffProfileId: current.staffProfileId }));
    if (current.recordStatus === "signed") throw new ConflictError("This record is already signed.");
    if (current.status === "cancelled") throw new ConflictError("This session was cancelled.");
    const { errors, clean, pinned } = await validateComplete(tx, await therapyOf(tx, current.enrollmentId), current.templateRefs, {
      historyAnswers: current.historyAnswers,
      assessmentAnswers: current.assessmentAnswers,
      noteAnswers: current.noteAnswers,
      doctorNote: input.doctorNote,
      outcome: input.outcome,
    });
    if (Object.keys(errors).length > 0) return { stepErrors: errors };
    const now = new Date();
    await tx
      .update(therapySessions)
      .set({ ...clean, templateRefs: pinned, doctorNote: input.doctorNote, outcome: input.outcome, recordStatus: "signed", signedAt: now, signedByUserId: actor.userId })
      .where(eq(therapySessions.id, current.id));
    await writeAudit(tx, { actorUserId: actor.userId, action: "session_record.sign", entityType: "therapy_session", entityId: current.id, after: { doctorNote: input.doctorNote, outcome: input.outcome, signedAt: now } });
    return {};
  });
}

/** Change a signed record: stores a new full version; the signed original is kept unchanged. */
export async function amendSession(actor: Actor, input: z.output<typeof amendSessionSchema>): Promise<SignOffResult> {
  return getDb().transaction(async (tx) => {
    const current = await lockSession(tx, input.sessionId);
    await authorizePatient(tx, actor, current.patientId, "update", (patient) => ({ type: "sessionRecord", patient, staffProfileId: current.staffProfileId }));
    if (current.recordStatus !== "signed") throw new ConflictError("Only a signed record can be amended. Edit the draft instead.");
    const [latest] = await tx
      .select({ version: recordAmendments.version, snapshot: recordAmendments.snapshot })
      .from(recordAmendments)
      .where(and(eq(recordAmendments.recordType, "therapy_session"), eq(recordAmendments.recordId, current.id)))
      .orderBy(desc(recordAmendments.version))
      .limit(1);
    const base: SessionRecordContent = latest
      ? (latest.snapshot as SessionRecordContent)
      : { historyAnswers: current.historyAnswers, assessmentAnswers: current.assessmentAnswers, noteAnswers: current.noteAnswers, doctorNote: current.doctorNote, outcome: current.outcome };
    const next: SessionRecordContent = { ...base };
    if (input.step === "signoff") {
      next.doctorNote = input.doctorNote ?? base.doctorNote;
      next.outcome = input.outcome ?? base.outcome;
    } else {
      next[STEP_COLUMN[input.step]] = input.answers ?? {};
    }
    const { errors, clean } = await validateComplete(tx, await therapyOf(tx, current.enrollmentId), current.templateRefs, next);
    if (Object.keys(errors).length > 0) return { stepErrors: errors };
    const snapshot = { ...next, ...clean };
    const version = (latest?.version ?? 0) + 1;
    await tx.insert(recordAmendments).values({ recordType: "therapy_session", recordId: current.id, version, snapshot, reason: input.reason, amendedByUserId: actor.userId });
    await writeAudit(tx, { actorUserId: actor.userId, action: "session_record.amend", entityType: "therapy_session", entityId: current.id, before: base, after: { ...snapshot, version, reason: input.reason } });
    return {};
  });
}

/** Staff the actor can schedule (admin): active doctors and specialists. */
export async function therapistOptions(): Promise<{ id: string; fullName: string }[]> {
  return getDb()
    .select({ id: staffProfiles.id, fullName: staffProfiles.fullName })
    .from(staffProfiles)
    .where(and(isNull(staffProfiles.archivedAt), sql`${staffProfiles.staffType} <> 'labour'`))
    .orderBy(asc(staffProfiles.fullName));
}
