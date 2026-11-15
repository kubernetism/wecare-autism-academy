import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Postgres enums. Values are appended (never reordered or removed) as later
 * phases need them; drizzle-kit emits `ALTER TYPE ... ADD VALUE` for that.
 * The TypeScript unions below are the single source of truth for app code.
 */

export const USER_ROLES = ["admin", "staff", "parent"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRole = pgEnum("user_role", USER_ROLES);

/** Labour staff (maid, cook...) are records for attendance/payroll only, no login. */
export const STAFF_TYPES = ["doctor", "specialist", "labour"] as const;
export type StaffType = (typeof STAFF_TYPES)[number];
export const staffType = pgEnum("staff_type", STAFF_TYPES);

export const APPOINTMENT_TYPES = [
  "appointment",
  "demo_session",
  "introduction",
] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export const appointmentType = pgEnum("appointment_type", APPOINTMENT_TYPES);

export const APPOINTMENT_STATUSES = [
  "pending",
  "approved",
  "scheduled",
  "rejected",
  "cancelled",
  "completed",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const appointmentStatus = pgEnum(
  "appointment_status",
  APPOINTMENT_STATUSES,
);

export const PREFERRED_TIMES = ["any", "morning", "afternoon", "evening"] as const;
export type PreferredTime = (typeof PREFERRED_TIMES)[number];
export const preferredTime = pgEnum("preferred_time", PREFERRED_TIMES);

/** Where a message came from. `portal` threads arrive in Phase 3. */
export const MESSAGE_SOURCES = ["contact_form", "portal"] as const;
export type MessageSource = (typeof MESSAGE_SOURCES)[number];
export const messageSource = pgEnum("message_source", MESSAGE_SOURCES);

export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];
export const messageDirection = pgEnum("message_direction", MESSAGE_DIRECTIONS);

export const MESSAGE_STATUSES = ["new", "read", "archived"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export const messageStatus = pgEnum("message_status", MESSAGE_STATUSES);

/* ---------- Phase 2: clinical core ---------- */

export const SEXES = ["female", "male", "other", "not_stated"] as const;
export type Sex = (typeof SEXES)[number];
export const sex = pgEnum("sex", SEXES);

export const PATIENT_STATUSES = ["active", "cancelled", "discharged"] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];
export const patientStatus = pgEnum("patient_status", PATIENT_STATUSES);

export const ADMISSION_KINDS = ["admit", "readmit", "cancel", "upgrade", "discharge"] as const;
export type AdmissionKind = (typeof ADMISSION_KINDS)[number];
export const admissionKind = pgEnum("admission_kind", ADMISSION_KINDS);

/** Lifecycle stages; each has its own record template per therapy line. */
export const LIFECYCLE_STAGES = ["intake", "assessment", "plan", "session_note", "progress_review", "discharge"] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
export const lifecycleStage = pgEnum("lifecycle_stage", LIFECYCLE_STAGES);

/** Templates ship as drafts for the clinic's clinicians to review. */
export const TEMPLATE_STATUSES = ["draft", "approved", "retired"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];
export const templateStatus = pgEnum("template_status", TEMPLATE_STATUSES);

export const ENROLLMENT_STATUSES = ["active", "on_hold", "completed", "discharged", "cancelled"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export const enrollmentStatus = pgEnum("enrollment_status", ENROLLMENT_STATUSES);

export const GOAL_STATUSES = ["not_started", "in_progress", "achieved", "discontinued"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const goalStatus = pgEnum("goal_status", GOAL_STATUSES);

export const SESSION_STATUSES = ["scheduled", "completed", "missed", "cancelled"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const sessionStatus = pgEnum("session_status", SESSION_STATUSES);

/** Clinical record state: drafts can be resumed; signed records are locked. */
export const RECORD_STATUSES = ["empty", "draft", "signed"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];
export const recordStatus = pgEnum("record_status", RECORD_STATUSES);

export const SESSION_OUTCOMES = ["progressing", "maintained", "regressed", "not_assessed"] as const;
export type SessionOutcome = (typeof SESSION_OUTCOMES)[number];
export const sessionOutcome = pgEnum("session_outcome", SESSION_OUTCOMES);

export const PATIENT_ATTENDANCE = ["present", "absent", "cancelled"] as const;
export type PatientAttendance = (typeof PATIENT_ATTENDANCE)[number];
export const patientAttendance = pgEnum("patient_attendance", PATIENT_ATTENDANCE);

export const STAFF_ATTENDANCE = ["present", "absent", "leave"] as const;
export type StaffAttendance = (typeof STAFF_ATTENDANCE)[number];
export const staffAttendance = pgEnum("staff_attendance", STAFF_ATTENDANCE);

export const AMENDABLE_RECORDS = ["therapy_session", "clinical_record"] as const;
export type AmendableRecord = (typeof AMENDABLE_RECORDS)[number];
export const amendableRecord = pgEnum("amendable_record", AMENDABLE_RECORDS);
