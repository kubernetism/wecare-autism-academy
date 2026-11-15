import { z } from "zod";
import { THERAPY_SLUGS } from "@/content/therapies";
import { MESSAGE_STATUSES } from "@/db/schema/enums";
import { emailSchema, passwordSchema, personNameSchema } from "./auth";
import {
  optionalEmail,
  optionalPhoneSchema,
  optionalText,
  optionalWebUrl,
  requiredText,
  uuidSchema,
} from "./common";

/* ---------- Appointment queue actions ---------- */

export const appointmentDecisionSchema = z.object({
  id: uuidSchema,
  note: optionalText(500),
});

export const rejectAppointmentSchema = z.object({
  id: uuidSchema,
  note: requiredText(3, 500, "a reason"),
});

export const scheduleAppointmentSchema = z.object({
  id: uuidSchema,
  /** ISO 8601 instant from the client's date-time picker. */
  start: z.iso.datetime({ offset: true, error: "Please choose a date and time." }),
  durationMinutes: z
    .number({ error: "Please choose a duration." })
    .int()
    .min(15, "At least 15 minutes.")
    .max(240, "At most 4 hours."),
  assignedStaffId: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    uuidSchema.nullable(),
  ),
  note: optionalText(500),
});
export type ScheduleAppointmentInput = z.input<typeof scheduleAppointmentSchema>;

/* ---------- Inbox ---------- */

export const setMessageStatusSchema = z.object({
  id: uuidSchema,
  status: z.enum(MESSAGE_STATUSES),
});

/* ---------- About (clinic profile) ---------- */

const listOf = <T extends z.ZodType>(item: T, max: number) =>
  z.array(item).max(max, `Up to ${max} items.`).default([]);

export const courseItemSchema = z.object({
  title: requiredText(1, 120, "a course title"),
  description: optionalText(500),
});

export const sessionItemSchema = z.object({
  title: requiredText(1, 120, "a session name"),
  duration: optionalText(60),
  description: optionalText(500),
});

export const bookItemSchema = z.object({
  title: requiredText(1, 200, "a book title"),
  author: optionalText(120),
  note: optionalText(300),
  url: optionalWebUrl,
});

export const learningSourceItemSchema = z.object({
  title: requiredText(1, 200, "a title"),
  url: optionalWebUrl,
  note: optionalText(300),
});

export const clinicProfileSchema = z.object({
  registeredName: requiredText(2, 160, "the registered name"),
  address: optionalText(500),
  phone: optionalPhoneSchema,
  email: optionalEmail,
  openingHours: optionalText(300),
  offeredCourses: listOf(courseItemSchema, 30),
  sessions: listOf(sessionItemSchema, 30),
  recommendedBooks: listOf(bookItemSchema, 50),
  learningSources: listOf(learningSourceItemSchema, 50),
});
export type ClinicProfileInput = z.input<typeof clinicProfileSchema>;
export type ClinicProfileData = z.output<typeof clinicProfileSchema>;

/* ---------- Staff accounts (admin only) ---------- */

export const createStaffAccountSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  /** Temporary password the admin shares with the staff member. */
  password: passwordSchema,
  staffType: z.enum(["doctor", "specialist"], { error: "Please choose a staff type." }),
  title: optionalText(120),
  therapySlugs: z.array(z.enum(THERAPY_SLUGS)).max(THERAPY_SLUGS.length).default([]),
});
export type CreateStaffAccountInput = z.input<typeof createStaffAccountSchema>;

/* ---------- Global search ---------- */

export const searchQuerySchema = z.string().trim().min(2).max(100);
