import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { staffType } from "./enums";
import { therapies } from "./therapies";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Every person who works at the clinic. Doctors/specialists have a login
 * (`userId`); labour staff are records only (`userId` null). Patient
 * assignments, events, attendance and payroll (Phases 2-3) reference this id,
 * never the auth user id, so login changes never touch clinical data.
 */
export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .unique()
      .references(() => users.id, { onDelete: "set null" }),
    fullName: text().notNull(),
    staffType: staffType().notNull(),
    title: text(),
    expertise: text().array().notNull().default(sql`'{}'::text[]`),
    experienceYears: smallint(),
    bio: text(),
    phone: text(),
    email: text(),
    joinedOn: date({ mode: "string" }),
    /**
     * Set by the admin after checking credentials. Verified, active doctors
     * and specialists are listed on the public Team page.
     */
    isVerified: boolean().notNull().default(false),
    /** Deactivation marker: null means active. People are never hard-deleted. */
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "staff_profiles_experience_years_check",
      sql`${t.experienceYears} is null or ${t.experienceYears} between 0 and 80`,
    ),
    index("staff_profiles_team_idx")
      .on(t.fullName)
      .where(sql`${t.isVerified} and ${t.archivedAt} is null and ${t.staffType} <> 'labour'`),
  ],
);

/** Which therapy lines a staff member works in. */
export const staffTherapies = pgTable(
  "staff_therapies",
  {
    staffProfileId: uuid()
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "cascade" }),
    therapyId: uuid()
      .notNull()
      .references(() => therapies.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.staffProfileId, t.therapyId] }),
    index("staff_therapies_therapy_id_idx").on(t.therapyId),
  ],
);

/**
 * A parent/guardian account. Created automatically when a parent registers.
 * Children are linked in Phase 3 (`parent_children` -> `patients`), bound by
 * tracking ID plus verified phone/email.
 */
export const parents = pgTable("parents", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: text(),
  phoneVerifiedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});
