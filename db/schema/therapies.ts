import {
  boolean,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The clinic's therapy lines. Seeded by migration (reference data), so every
 * environment has the same four rows and slugs. `slug` is the stable key the
 * website content and forms use; `id` is what other tables reference.
 */
export const therapies = pgTable("therapies", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  shortName: text().notNull(),
  summary: text().notNull(),
  sortOrder: smallint().notNull().default(0),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
