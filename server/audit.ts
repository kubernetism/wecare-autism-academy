import "server-only";
import type { Database, Transaction } from "@/db/create-db";
import { auditLog } from "@/db/schema";

type AuditEntry = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

/** Write an audit row inside the caller's transaction. */
export async function writeAudit(
  tx: Database | Transaction,
  entry: AuditEntry,
): Promise<void> {
  await tx.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
