import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export type CourseItem = { title: string; description?: string };
export type SessionItem = {
  title: string;
  duration?: string;
  description?: string;
};
export type BookItem = {
  title: string;
  author?: string;
  note?: string;
  url?: string;
};
export type LearningSourceItem = { title: string; url?: string; note?: string };

/**
 * Single-row table (id is always 1) holding the clinic details shown on the
 * About and Contact pages. Null means "not provided yet": the website shows a
 * clearly marked placeholder instead of inventing a value.
 */
export const clinicProfile = pgTable(
  "clinic_profile",
  {
    id: smallint().primaryKey().default(1),
    registeredName: text().notNull(),
    address: text(),
    phone: text(),
    email: text(),
    openingHours: text(),
    offeredCourses: jsonb()
      .$type<CourseItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sessions: jsonb()
      .$type<SessionItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    recommendedBooks: jsonb()
      .$type<BookItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    learningSources: jsonb()
      .$type<LearningSourceItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedByUserId: text().references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("clinic_profile_singleton_check", sql`${t.id} = 1`)],
);
