import "server-only";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { admissions, clinicalRecords, enrollments, goals, patients, staffProfiles, therapies, therapySessions } from "@/db/schema";
import type { EnrollmentStatus, GoalStatus, LifecycleStage, RecordStatus } from "@/db/schema/enums";
import { assertCan, type Actor } from "@/lib/permissions";
import type { enrollSchema, goalSchema, goalStatusSchema, upgradeSchema } from "@/lib/validation/clinical";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { authorizePatient } from "./patient-access";
import { assignStaff } from "./patients";

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Admin: enroll a patient in a therapy line with a plan; the lead therapist is assigned to the patient. */
export async function enroll(actor: Actor, input: z.output<typeof enrollSchema>): Promise<{ id: string }> {
  try {
    return await getDb().transaction(async (tx) => {
      await authorizePatient(tx, actor, input.patientId, "create", (patient) => ({ type: "enrollment", patient }));
      const [patient] = await tx.select({ status: patients.status }).from(patients).where(eq(patients.id, input.patientId)).limit(1);
      if (patient?.status !== "active") throw new ConflictError("Only active patients can be enrolled. Re-admit the patient first.");
      const [therapy] = await tx.select({ id: therapies.id }).from(therapies).where(and(eq(therapies.slug, input.therapySlug), eq(therapies.isActive, true))).limit(1);
      if (!therapy) throw new NotFoundError("That therapy line is not available.");
      await assignStaff(actor, input.patientId, input.leadStaffId, tx);
      const [row] = await tx
        .insert(enrollments)
        .values({
          patientId: input.patientId,
          therapyId: therapy.id,
          leadStaffId: input.leadStaffId,
          plannedSessions: input.plannedSessions,
          sessionsPerWeek: input.sessionsPerWeek,
          sessionMinutes: input.sessionMinutes,
          startDate: input.startDate,
          createdByUserId: actor.userId,
        })
        .returning({ id: enrollments.id });
      if (!row) throw new Error("Insert returned no row");
      await writeAudit(tx, { actorUserId: actor.userId, action: "enrollment.create", entityType: "enrollment", entityId: row.id, after: input });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictError("This patient already has an open enrollment in that therapy.");
    throw error;
  }
}

/** Admin: change an enrollment's plan (therapy level); recorded as an "upgrade" in the admission history. */
export async function upgradeEnrollment(actor: Actor, input: z.output<typeof upgradeSchema>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(enrollments).where(eq(enrollments.id, input.enrollmentId)).for("update").limit(1);
    if (!current) throw new NotFoundError("This enrollment does not exist.");
    await authorizePatient(tx, actor, current.patientId, "create", (patient) => ({ type: "admission", patient }));
    if (current.status !== "active" && current.status !== "on_hold") throw new ConflictError("Only an open enrollment can be changed.");
    const before = { plannedSessions: current.plannedSessions, sessionsPerWeek: current.sessionsPerWeek, sessionMinutes: current.sessionMinutes };
    const after = { plannedSessions: input.plannedSessions, sessionsPerWeek: input.sessionsPerWeek, sessionMinutes: input.sessionMinutes };
    await tx.update(enrollments).set(after).where(eq(enrollments.id, current.id));
    await tx.insert(admissions).values({
      patientId: current.patientId,
      kind: "upgrade",
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      enrollmentId: current.id,
      details: { before, after },
      actorUserId: actor.userId,
    });
    await writeAudit(tx, { actorUserId: actor.userId, action: "enrollment.upgrade", entityType: "enrollment", entityId: current.id, before, after: { ...after, reason: input.reason } });
  });
}

export type GoalRow = {
  id: string;
  title: string;
  baseline: string | null;
  target: string | null;
  measure: string | null;
  status: GoalStatus;
  targetDate: string | null;
};

export type StageRecordRow = { id: string; stage: LifecycleStage; status: RecordStatus; templateVersion: number; updatedAt: string; signedAt: string | null };

export type EnrollmentView = {
  id: string;
  therapyId: string;
  therapyName: string;
  therapySlug: string;
  status: EnrollmentStatus;
  leadStaffId: string | null;
  leadStaffName: string | null;
  plannedSessions: number;
  sessionsPerWeek: number;
  sessionMinutes: number;
  startDate: string;
  completed: number;
  missed: number;
  cancelled: number;
  upcoming: number;
  signedRecords: number;
  goals: GoalRow[];
  records: StageRecordRow[];
  /** Dates each lifecycle stage was first reached, for the timeline. */
  stages: Partial<Record<LifecycleStage | "sessions", string>>;
};

export async function listEnrollments(actor: Actor, patientId: string): Promise<EnrollmentView[]> {
  const db = getDb();
  await authorizePatient(db, actor, patientId, "read", (patient) => ({ type: "enrollment", patient }));

  const rows = await db
    .select({
      id: enrollments.id,
      therapyId: enrollments.therapyId,
      therapyName: therapies.name,
      therapySlug: therapies.slug,
      status: enrollments.status,
      leadStaffId: enrollments.leadStaffId,
      leadStaffName: staffProfiles.fullName,
      plannedSessions: enrollments.plannedSessions,
      sessionsPerWeek: enrollments.sessionsPerWeek,
      sessionMinutes: enrollments.sessionMinutes,
      startDate: enrollments.startDate,
      createdAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(therapies, eq(therapies.id, enrollments.therapyId))
    .leftJoin(staffProfiles, eq(staffProfiles.id, enrollments.leadStaffId))
    .where(eq(enrollments.patientId, patientId))
    .orderBy(asc(enrollments.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const sessionStats = await db
    .select({
      enrollmentId: therapySessions.enrollmentId,
      completed: sql<number>`count(*) filter (where ${therapySessions.status} = 'completed')::int`,
      missed: sql<number>`count(*) filter (where ${therapySessions.status} = 'missed')::int`,
      cancelled: sql<number>`count(*) filter (where ${therapySessions.status} = 'cancelled')::int`,
      upcoming: sql<number>`count(*) filter (where ${therapySessions.status} = 'scheduled')::int`,
      signed: sql<number>`count(*) filter (where ${therapySessions.recordStatus} = 'signed')::int`,
      firstCompleted: sql<string | null>`min(${therapySessions.scheduledStart}) filter (where ${therapySessions.status} = 'completed')`,
      firstHistory: sql<string | null>`min(${therapySessions.scheduledStart}) filter (where ${therapySessions.historyAnswers} <> '{}'::jsonb)`,
      firstAssessment: sql<string | null>`min(${therapySessions.scheduledStart}) filter (where ${therapySessions.assessmentAnswers} <> '{}'::jsonb)`,
    })
    .from(therapySessions)
    .where(and(inArray(therapySessions.enrollmentId, ids), isNull(therapySessions.deletedAt)))
    .groupBy(therapySessions.enrollmentId);

  const goalRows = await db
    .select({ id: goals.id, enrollmentId: goals.enrollmentId, title: goals.title, baseline: goals.baseline, target: goals.target, measure: goals.measure, status: goals.status, targetDate: goals.targetDate })
    .from(goals)
    .where(and(inArray(goals.enrollmentId, ids), isNull(goals.deletedAt)))
    .orderBy(asc(goals.createdAt));

  const recordRows = await db
    .select({ id: clinicalRecords.id, enrollmentId: clinicalRecords.enrollmentId, stage: clinicalRecords.stage, status: clinicalRecords.status, templateVersion: clinicalRecords.templateVersion, updatedAt: clinicalRecords.updatedAt, signedAt: clinicalRecords.signedAt, createdAt: clinicalRecords.createdAt })
    .from(clinicalRecords)
    .where(and(inArray(clinicalRecords.enrollmentId, ids), isNull(clinicalRecords.deletedAt)))
    .orderBy(asc(clinicalRecords.createdAt));

  return rows.map((r) => {
    const stats = sessionStats.find((s) => s.enrollmentId === r.id);
    const records = recordRows.filter((x) => x.enrollmentId === r.id);
    const firstOf = (stage: LifecycleStage) => records.find((x) => x.stage === stage)?.createdAt.toISOString();
    const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : undefined);
    const stages: EnrollmentView["stages"] = {
      intake: firstOf("intake") ?? iso(stats?.firstHistory) ?? r.createdAt.toISOString(),
      assessment: firstOf("assessment") ?? iso(stats?.firstAssessment),
      plan: firstOf("plan"),
      sessions: iso(stats?.firstCompleted),
      progress_review: firstOf("progress_review"),
      discharge: firstOf("discharge"),
    };
    return {
      ...r,
      completed: stats?.completed ?? 0,
      missed: stats?.missed ?? 0,
      cancelled: stats?.cancelled ?? 0,
      upcoming: stats?.upcoming ?? 0,
      signedRecords: stats?.signed ?? 0,
      goals: goalRows.filter((g) => g.enrollmentId === r.id),
      records: records.map((x) => ({ id: x.id, stage: x.stage, status: x.status, templateVersion: x.templateVersion, updatedAt: x.updatedAt.toISOString(), signedAt: x.signedAt?.toISOString() ?? null })),
      stages,
    };
  });
}

async function enrollmentPatient(enrollmentId: string) {
  const [row] = await getDb().select({ patientId: enrollments.patientId }).from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
  if (!row) throw new NotFoundError("This enrollment does not exist.");
  return row.patientId;
}

/** Staff (assigned) or admin: add a goal to an enrollment. */
export async function addGoal(actor: Actor, input: z.output<typeof goalSchema>): Promise<void> {
  const patientId = await enrollmentPatient(input.enrollmentId);
  await getDb().transaction(async (tx) => {
    await authorizePatient(tx, actor, patientId, "create", (patient) => ({ type: "clinicalRecord", kind: "goal", patient }));
    const [row] = await tx
      .insert(goals)
      .values({
        enrollmentId: input.enrollmentId,
        patientId,
        title: input.title,
        baseline: input.baseline ?? null,
        target: input.target ?? null,
        measure: input.measure ?? null,
        targetDate: input.targetDate ?? null,
        createdByUserId: actor.userId,
      })
      .returning({ id: goals.id });
    if (!row) throw new Error("Insert returned no row");
    await writeAudit(tx, { actorUserId: actor.userId, action: "goal.create", entityType: "goal", entityId: row.id, after: input });
  });
}

export async function setGoalStatus(actor: Actor, input: z.output<typeof goalStatusSchema>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [goal] = await tx.select().from(goals).where(and(eq(goals.id, input.id), isNull(goals.deletedAt))).for("update").limit(1);
    if (!goal) throw new NotFoundError("This goal does not exist.");
    await authorizePatient(tx, actor, goal.patientId, "update", (patient) => ({ type: "clinicalRecord", kind: "goal", patient }));
    await tx.update(goals).set({ status: input.status }).where(eq(goals.id, goal.id));
    await writeAudit(tx, { actorUserId: actor.userId, action: "goal.status", entityType: "goal", entityId: goal.id, before: { status: goal.status }, after: { status: input.status } });
  });
}

/** Admin only: soft delete. */
export async function deleteGoal(actor: Actor, id: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [goal] = await tx.select().from(goals).where(and(eq(goals.id, id), isNull(goals.deletedAt))).limit(1);
    if (!goal) throw new NotFoundError("This goal does not exist.");
    await authorizePatient(tx, actor, goal.patientId, "delete", (patient) => ({ type: "clinicalRecord", kind: "goal", patient }));
    await tx.update(goals).set({ deletedAt: new Date() }).where(eq(goals.id, id));
    await writeAudit(tx, { actorUserId: actor.userId, action: "goal.delete", entityType: "goal", entityId: id, before: goal });
  });
}

/** Enrollment options for scheduling (open enrollments of active patients). */
export async function openEnrollmentOptions(actor: Actor) {
  assertCan(actor, "create", { type: "therapySession", patient: { assignedStaffProfileIds: [], parentIds: [] }, staffProfileId: null });
  return getDb()
    .select({
      id: enrollments.id,
      patientId: patients.id,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      trackingId: patients.trackingId,
      therapyName: therapies.name,
      leadStaffId: enrollments.leadStaffId,
      sessionMinutes: enrollments.sessionMinutes,
    })
    .from(enrollments)
    .innerJoin(patients, eq(patients.id, enrollments.patientId))
    .innerJoin(therapies, eq(therapies.id, enrollments.therapyId))
    .where(and(inArray(enrollments.status, ["active", "on_hold"]), eq(patients.status, "active"), isNull(patients.deletedAt), ne(patients.status, "cancelled")))
    .orderBy(asc(patients.lastName));
}
