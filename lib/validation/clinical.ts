import { z } from "zod";
import {
  GOAL_STATUSES,
  LIFECYCLE_STAGES,
  PATIENT_ATTENDANCE,
  PATIENT_STATUSES,
  SESSION_OUTCOMES,
  SEXES,
  STAFF_ATTENDANCE,
  STAFF_TYPES,
} from "@/db/schema/enums";
import { THERAPY_SLUGS } from "@/content/therapies";
import { emailSchema, passwordSchema, personNameSchema } from "./auth";
import { optionalEmail, optionalPhoneSchema, optionalText, phoneSchema, requiredText, uuidSchema } from "./common";

/** Shared by Phase 2 forms (client) and Server Actions (server). */

const isoDate = (label: string) => z.iso.date(`Please enter a valid ${label}.`);
const optionalIsoDate = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.iso.date("Please enter a valid date.").optional());

/* ---------- Patients ---------- */

export const patientDetailsSchema = z.object({
  firstName: requiredText(1, 80, "the first name"),
  lastName: requiredText(1, 80, "the last name"),
  preferredName: optionalText(80),
  dateOfBirth: isoDate("date of birth").refine((d) => d <= new Date().toISOString().slice(0, 10), "The date of birth cannot be in the future."),
  sex: z.enum(SEXES).default("not_stated"),
  diagnosisSummary: optionalText(500),
  guardianName: personNameSchema,
  guardianRelationship: requiredText(2, 60, "the relationship"),
  guardianPhone: phoneSchema,
  guardianEmail: optionalEmail,
  address: optionalText(500),
  notes: optionalText(2000),
});
export type PatientDetailsInput = z.input<typeof patientDetailsSchema>;

export const admitPatientSchema = patientDetailsSchema.extend({
  admittedOn: isoDate("admission date"),
  reason: optionalText(500),
  assignStaffIds: z.array(uuidSchema).max(10).default([]),
});
export type AdmitPatientInput = z.input<typeof admitPatientSchema>;

export const updatePatientSchema = patientDetailsSchema.extend({ id: uuidSchema });

export const cancelPatientSchema = z.object({
  id: uuidSchema,
  effectiveOn: isoDate("date"),
  reason: requiredText(3, 500, "a reason"),
});

export const readmitPatientSchema = z.object({
  id: uuidSchema,
  effectiveOn: isoDate("date"),
  reason: optionalText(500),
});

export const assignStaffSchema = z.object({ patientId: uuidSchema, staffProfileId: uuidSchema });

export const patientListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(PATIENT_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
});

/* ---------- Enrollments and goals ---------- */

export const enrollSchema = z.object({
  patientId: uuidSchema,
  therapySlug: z.enum(THERAPY_SLUGS, { error: "Please choose a therapy." }),
  leadStaffId: uuidSchema,
  plannedSessions: z.number({ error: "Enter the number of sessions." }).int().min(1).max(500),
  sessionsPerWeek: z.number({ error: "Enter sessions per week." }).int().min(1).max(14),
  sessionMinutes: z.number({ error: "Choose a session length." }).int().min(15).max(240),
  startDate: isoDate("start date"),
});
export type EnrollInput = z.input<typeof enrollSchema>;

/** Upgrade: a change to an enrollment's plan, recorded in admissions history. */
export const upgradeSchema = z.object({
  enrollmentId: uuidSchema,
  plannedSessions: z.number().int().min(1).max(500),
  sessionsPerWeek: z.number().int().min(1).max(14),
  sessionMinutes: z.number().int().min(15).max(240),
  effectiveOn: isoDate("date"),
  reason: requiredText(3, 500, "a reason"),
});
export type UpgradeInput = z.input<typeof upgradeSchema>;

export const goalSchema = z.object({
  enrollmentId: uuidSchema,
  title: requiredText(3, 200, "the goal"),
  baseline: optionalText(300),
  target: optionalText(300),
  measure: optionalText(200),
  targetDate: optionalIsoDate,
});
export type GoalInput = z.input<typeof goalSchema>;

export const goalStatusSchema = z.object({ id: uuidSchema, status: z.enum(GOAL_STATUSES) });

/* ---------- Sessions ---------- */

export const scheduleSessionSchema = z.object({
  enrollmentId: uuidSchema,
  staffProfileId: uuidSchema,
  start: z.iso.datetime({ offset: true, error: "Please choose a date and time." }),
  durationMinutes: z.number().int().min(15).max(240),
  repeatWeeks: z.number().int().min(1).max(26).default(1),
});
export type ScheduleSessionInput = z.input<typeof scheduleSessionSchema>;

export const rescheduleSessionSchema = z.object({
  id: uuidSchema,
  staffProfileId: uuidSchema,
  start: z.iso.datetime({ offset: true, error: "Please choose a date and time." }),
  durationMinutes: z.number().int().min(15).max(240),
});

export const cancelSessionSchema = z.object({ id: uuidSchema, reason: requiredText(3, 300, "a reason") });

export const WIZARD_STEPS = ["history", "assessment", "notes"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const saveSessionStepSchema = z.object({
  sessionId: uuidSchema,
  step: z.enum(WIZARD_STEPS),
  answers: z.record(z.string(), z.unknown()),
});

export const signOffSessionSchema = z.object({
  sessionId: uuidSchema,
  doctorNote: requiredText(3, 3000, "the doctor note"),
  outcome: z.enum(SESSION_OUTCOMES, { error: "Please choose the session outcome." }),
});

export const amendSessionSchema = z.object({
  sessionId: uuidSchema,
  step: z.enum([...WIZARD_STEPS, "signoff"]),
  answers: z.record(z.string(), z.unknown()).optional(),
  doctorNote: optionalText(3000),
  outcome: z.enum(SESSION_OUTCOMES).optional(),
  reason: requiredText(5, 500, "the reason for the amendment"),
});

/* ---------- Stage records (plan, progress review, discharge) ---------- */

export const createStageRecordSchema = z.object({
  enrollmentId: uuidSchema,
  stage: z.enum(LIFECYCLE_STAGES).refine((s) => s !== "session_note", "Session notes are written in the session wizard."),
});

export const saveStageRecordSchema = z.object({ id: uuidSchema, answers: z.record(z.string(), z.unknown()) });
export const signStageRecordSchema = saveStageRecordSchema;
export const amendStageRecordSchema = saveStageRecordSchema.extend({ reason: requiredText(5, 500, "the reason for the amendment") });

/* ---------- Attendance ---------- */

export const patientAttendanceSchema = z
  .object({
    sessionId: uuidSchema,
    status: z.enum(PATIENT_ATTENDANCE),
    reason: optionalText(300),
  })
  .refine((v) => v.status === "present" || Boolean(v.reason), { path: ["reason"], message: "Please give a reason." });

export const staffAttendanceSchema = z.object({
  staffProfileId: uuidSchema,
  day: isoDate("date"),
  status: z.enum(STAFF_ATTENDANCE),
  checkIn: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.").optional()),
  checkOut: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM.").optional()),
  note: optionalText(300),
});
export type StaffAttendanceInput = z.input<typeof staffAttendanceSchema>;

/* ---------- Staff ---------- */

export const staffProfileSchema = z
  .object({
    fullName: personNameSchema,
    staffType: z.enum(STAFF_TYPES, { error: "Please choose a staff type." }),
    title: optionalText(120),
    expertise: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
    experienceYears: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.number().int().min(0).max(80).optional()),
    therapySlugs: z.array(z.enum(THERAPY_SLUGS)).max(THERAPY_SLUGS.length).default([]),
    phone: optionalPhoneSchema,
    email: optionalEmail,
    joinedOn: optionalIsoDate,
    bio: optionalText(1000),
    isVerified: z.boolean().default(false),
    /** Doctors and specialists may get a login; labour staff never do. */
    createLogin: z.boolean().default(false),
    loginEmail: z.preprocess((v) => (v === "" ? undefined : v), emailSchema.optional()),
    loginPassword: z.preprocess((v) => (v === "" ? undefined : v), passwordSchema.optional()),
  })
  .superRefine((v, ctx) => {
    if (!v.createLogin) return;
    if (v.staffType === "labour") ctx.addIssue({ code: "custom", path: ["createLogin"], message: "Support staff do not get a login." });
    if (!v.loginEmail) ctx.addIssue({ code: "custom", path: ["loginEmail"], message: "Please enter the login email." });
    if (!v.loginPassword) ctx.addIssue({ code: "custom", path: ["loginPassword"], message: "Please enter a temporary password." });
  });
export type StaffProfileInput = z.input<typeof staffProfileSchema>;

export const updateStaffSchema = z.object({
  id: uuidSchema,
  fullName: personNameSchema,
  staffType: z.enum(STAFF_TYPES),
  title: optionalText(120),
  expertise: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
  experienceYears: z.preprocess((v) => (v === null || v === "" ? undefined : v), z.number().int().min(0).max(80).optional()),
  therapySlugs: z.array(z.enum(THERAPY_SLUGS)).max(THERAPY_SLUGS.length).default([]),
  phone: optionalPhoneSchema,
  email: optionalEmail,
  joinedOn: optionalIsoDate,
  bio: optionalText(1000),
  isVerified: z.boolean().default(false),
});
export type UpdateStaffInput = z.input<typeof updateStaffSchema>;

export const setStaffActiveSchema = z.object({ id: uuidSchema, active: z.boolean() });
