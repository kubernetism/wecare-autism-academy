import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  admissionKind,
  amendableRecord,
  enrollmentStatus,
  goalStatus,
  lifecycleStage,
  patientAttendance,
  patientStatus,
  recordStatus,
  sessionOutcome,
  sessionStatus,
  sex,
  staffAttendance,
  templateStatus,
} from "./enums";
import { staffProfiles } from "./people";
import { therapies } from "./therapies";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Template answers keyed by field key (see lib/templates). */
export type TemplateAnswers = Record<string, unknown>;

/* ---------- Patients ---------- */

/**
 * Per-year counter behind tracking IDs (WCA-YYYY-NNNN). Incremented with a
 * single INSERT ... ON CONFLICT DO UPDATE ... RETURNING inside the admit
 * transaction, so concurrent admissions never get the same number.
 */
export const trackingCounters = pgTable("tracking_counters", {
  year: smallint().primaryKey(),
  lastValue: integer().notNull(),
});

export const patients = pgTable(
  "patients",
  {
    id: uuid().primaryKey().defaultRandom(),
    trackingId: text().notNull().unique(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    preferredName: text(),
    dateOfBirth: date({ mode: "string" }).notNull(),
    sex: sex().notNull().default("not_stated"),
    diagnosisSummary: text(),
    guardianName: text().notNull(),
    guardianRelationship: text().notNull(),
    guardianPhone: text().notNull(),
    guardianEmail: text(),
    address: text(),
    notes: text(),
    status: patientStatus().notNull().default("active"),
    createdByUserId: text().references(() => users.id, { onDelete: "set null" }),
    /** Soft delete (admin only). Clinical data is never hard-deleted. */
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("patients_tracking_id_format", sql`${t.trackingId} ~ '^WCA-[0-9]{4}-[0-9]{4,}$'`),
    index("patients_status_idx").on(t.status, t.lastName),
    // Fast ILIKE '%term%' search on names (pg_trgm, created in migration 0002).
    index("patients_name_trgm_idx").using("gin", sql`(${t.firstName} || ' ' || ${t.lastName}) gin_trgm_ops`),
  ],
);

/** Admit / re-admit / cancel / upgrade / discharge history. */
export const admissions = pgTable(
  "admissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: admissionKind().notNull(),
    effectiveOn: date({ mode: "string" }).notNull(),
    reason: text(),
    /** Upgrade: the enrollment whose plan changed, with before/after plan values. */
    enrollmentId: uuid(),
    details: jsonb().$type<Record<string, unknown>>(),
    actorUserId: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admissions_patient_idx").on(t.patientId, t.createdAt)],
);

/**
 * Which staff look after which patient. Rows are closed (unassignedAt) rather
 * than deleted, so the history stays. One open row per patient and staff.
 */
export const patientStaff = pgTable(
  "patient_staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    staffProfileId: uuid()
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "cascade" }),
    assignedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    assignedByUserId: text().references(() => users.id, { onDelete: "set null" }),
    unassignedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("patient_staff_open_unique").on(t.patientId, t.staffProfileId).where(sql`${t.unassignedAt} is null`),
    index("patient_staff_staff_idx").on(t.staffProfileId).where(sql`${t.unassignedAt} is null`),
  ],
);

/** Uploaded files. Bytes live in private storage under `storageKey`. */
export const medicalFiles = pgTable(
  "medical_files",
  {
    id: uuid().primaryKey().defaultRandom(),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    storageKey: text().notNull().unique(),
    originalName: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    sha256: text().notNull(),
    description: text(),
    uploadedByUserId: text().references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("medical_files_patient_idx").on(t.patientId, t.createdAt)],
);

/* ---------- Templates, enrollments, goals ---------- */

/** Versioned record templates (JSON field specs) per therapy line and stage. */
export const formTemplates = pgTable(
  "form_templates",
  {
    id: uuid().primaryKey().defaultRandom(),
    therapyId: uuid()
      .notNull()
      .references(() => therapies.id, { onDelete: "restrict" }),
    stage: lifecycleStage().notNull(),
    version: smallint().notNull(),
    title: text().notNull(),
    schema: jsonb().notNull(),
    status: templateStatus().notNull().default("draft"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("form_templates_version_unique").on(t.therapyId, t.stage, t.version)],
);

/** A patient's course in one therapy line, with its plan. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid().primaryKey().defaultRandom(),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    therapyId: uuid()
      .notNull()
      .references(() => therapies.id, { onDelete: "restrict" }),
    leadStaffId: uuid().references(() => staffProfiles.id, { onDelete: "set null" }),
    status: enrollmentStatus().notNull().default("active"),
    plannedSessions: smallint().notNull(),
    sessionsPerWeek: smallint().notNull(),
    sessionMinutes: smallint().notNull(),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }),
    createdByUserId: text().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    check("enrollments_plan_check", sql`${t.plannedSessions} between 1 and 500 and ${t.sessionsPerWeek} between 1 and 14 and ${t.sessionMinutes} between 15 and 240`),
    uniqueIndex("enrollments_open_unique").on(t.patientId, t.therapyId).where(sql`${t.status} in ('active', 'on_hold')`),
    index("enrollments_patient_idx").on(t.patientId),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    title: text().notNull(),
    baseline: text(),
    target: text(),
    measure: text(),
    status: goalStatus().notNull().default("not_started"),
    targetDate: date({ mode: "string" }),
    createdByUserId: text().references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("goals_enrollment_idx").on(t.enrollmentId)],
);

/* ---------- Clinical records ---------- */

/**
 * Enrollment-level stage records (treatment plan, progress review, discharge;
 * intake/assessment can be recorded here too). Drafts are editable; signed
 * records are locked and changed only through record_amendments.
 */
export const clinicalRecords = pgTable(
  "clinical_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    stage: lifecycleStage().notNull(),
    templateId: uuid()
      .notNull()
      .references(() => formTemplates.id, { onDelete: "restrict" }),
    templateVersion: smallint().notNull(),
    answers: jsonb().$type<TemplateAnswers>().notNull().default(sql`'{}'::jsonb`),
    status: recordStatus().notNull().default("draft"),
    authorStaffId: uuid().references(() => staffProfiles.id, { onDelete: "set null" }),
    signedAt: timestamp({ withTimezone: true }),
    signedByUserId: text().references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("clinical_records_enrollment_idx").on(t.enrollmentId, t.stage)],
);

/**
 * A scheduled therapy session and its record (filled with the session wizard:
 * history and symptoms, assessment, session notes, doctor note and sign-off).
 */
export const therapySessions = pgTable(
  "therapy_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    patientId: uuid()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    staffProfileId: uuid()
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "restrict" }),
    scheduledStart: timestamp({ withTimezone: true }).notNull(),
    scheduledEnd: timestamp({ withTimezone: true }).notNull(),
    status: sessionStatus().notNull().default("scheduled"),
    recordStatus: recordStatus().notNull().default("empty"),
    /** Template id + version per wizard step, recorded when answers are first saved. */
    templateRefs: jsonb().$type<Record<string, { templateId: string; version: number }>>().notNull().default(sql`'{}'::jsonb`),
    historyAnswers: jsonb().$type<TemplateAnswers>().notNull().default(sql`'{}'::jsonb`),
    assessmentAnswers: jsonb().$type<TemplateAnswers>().notNull().default(sql`'{}'::jsonb`),
    noteAnswers: jsonb().$type<TemplateAnswers>().notNull().default(sql`'{}'::jsonb`),
    doctorNote: text(),
    outcome: sessionOutcome(),
    signedAt: timestamp({ withTimezone: true }),
    signedByUserId: text().references(() => users.id, { onDelete: "set null" }),
    createdByUserId: text().references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("therapy_sessions_order_check", sql`${t.scheduledEnd} > ${t.scheduledStart}`),
    index("therapy_sessions_staff_start_idx").on(t.staffProfileId, t.scheduledStart),
    index("therapy_sessions_patient_start_idx").on(t.patientId, t.scheduledStart),
    index("therapy_sessions_enrollment_idx").on(t.enrollmentId),
  ],
);

/** Changes to signed records. The original row is never modified. */
export const recordAmendments = pgTable(
  "record_amendments",
  {
    id: uuid().primaryKey().defaultRandom(),
    recordType: amendableRecord().notNull(),
    recordId: uuid().notNull(),
    version: smallint().notNull(),
    /** Full record content as amended. */
    snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    reason: text().notNull(),
    amendedByUserId: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("record_amendments_version_unique").on(t.recordType, t.recordId, t.version)],
);

/* ---------- Attendance ---------- */

export const attendancePatient = pgTable("attendance_patient", {
  id: uuid().primaryKey().defaultRandom(),
  sessionId: uuid()
    .notNull()
    .unique()
    .references(() => therapySessions.id, { onDelete: "cascade" }),
  patientId: uuid()
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  status: patientAttendance().notNull(),
  reason: text(),
  markedByUserId: text().references(() => users.id, { onDelete: "set null" }),
  markedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Daily staff attendance (doctors, specialists and labour). One row per person per day. */
export const attendanceStaff = pgTable(
  "attendance_staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    staffProfileId: uuid()
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    status: staffAttendance().notNull(),
    checkInAt: timestamp({ withTimezone: true }),
    checkOutAt: timestamp({ withTimezone: true }),
    note: text(),
    markedByUserId: text().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attendance_staff_day_unique").on(t.staffProfileId, t.day),
    check("attendance_staff_times_check", sql`${t.checkOutAt} is null or ${t.checkInAt} is null or ${t.checkOutAt} >= ${t.checkInAt}`),
  ],
);
