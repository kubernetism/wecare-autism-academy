import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Append-only record of who changed what. Every create/update/delete of
 * patient, clinical, finance and admin data writes a row in the same
 * transaction as the change. Never store secrets or password hashes here.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: text().references(() => users.id, { onDelete: "set null" }),
    /** Dotted verb, e.g. `appointment.schedule`, `clinic_profile.update`. */
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    index("audit_log_actor_idx").on(t.actorUserId, t.createdAt),
  ],
);
