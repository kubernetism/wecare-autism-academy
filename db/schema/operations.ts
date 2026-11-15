import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import {
  appointmentStatus,
  appointmentType,
  messageDirection,
  messageSource,
  messageStatus,
  preferredTime,
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

/**
 * Requests from the website (appointment / demo session / introduction) and
 * their lifecycle: pending -> approved -> scheduled -> completed, or
 * rejected / cancelled. Phase 2 adds `patient_id` and the per-therapist
 * calendar reads `assigned_staff_id` + `scheduled_start`.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: appointmentType().notNull(),
    status: appointmentStatus().notNull().default("pending"),
    contactName: text().notNull(),
    contactEmail: text().notNull(),
    contactPhone: text().notNull(),
    childName: text(),
    childAgeYears: smallint(),
    therapyId: uuid().references(() => therapies.id, { onDelete: "set null" }),
    preferredDate: date({ mode: "string" }),
    preferredTime: preferredTime().notNull().default("any"),
    message: text(),
    /** Set when a signed-in parent made the request (Phase 3 tracking). */
    requestedByUserId: text().references(() => users.id, {
      onDelete: "set null",
    }),
    assignedStaffId: uuid().references(() => staffProfiles.id, {
      onDelete: "set null",
    }),
    scheduledStart: timestamp({ withTimezone: true }),
    scheduledEnd: timestamp({ withTimezone: true }),
    /** Internal note: reason for rejection, scheduling details. */
    decisionNote: text(),
    decidedByUserId: text().references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "appointments_child_age_check",
      sql`${t.childAgeYears} is null or ${t.childAgeYears} between 0 and 30`,
    ),
    check(
      "appointments_scheduled_has_time_check",
      sql`${t.status} <> 'scheduled' or ${t.scheduledStart} is not null`,
    ),
    check(
      "appointments_schedule_order_check",
      sql`${t.scheduledEnd} is null or ${t.scheduledStart} is null or ${t.scheduledEnd} > ${t.scheduledStart}`,
    ),
    index("appointments_status_created_idx").on(t.status, t.createdAt.desc()),
    index("appointments_staff_start_idx").on(t.assignedStaffId, t.scheduledStart),
    index("appointments_requested_by_idx").on(t.requestedByUserId),
  ],
);

/**
 * Contact-form messages now; parent portal threads in Phase 3. A reply or
 * follow-up points at the first message of its thread via `thread_id`.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    threadId: uuid().references((): AnyPgColumn => messages.id, {
      onDelete: "cascade",
    }),
    source: messageSource().notNull(),
    direction: messageDirection().notNull().default("inbound"),
    status: messageStatus().notNull().default("new"),
    senderUserId: text().references(() => users.id, { onDelete: "set null" }),
    senderName: text().notNull(),
    senderEmail: text(),
    senderPhone: text(),
    subject: text().notNull(),
    body: text().notNull(),
    readAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("messages_status_created_idx").on(t.status, t.createdAt.desc()),
    index("messages_thread_id_idx").on(t.threadId),
  ],
);
