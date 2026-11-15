import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { messages } from "@/db/schema";
import type { MessageSource, MessageStatus } from "@/db/schema/enums";
import { assertCan, scopeFor, type Actor } from "@/lib/permissions";
import type { ContactData } from "@/lib/validation/public-forms";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { NotFoundError } from "../errors";

export type MessageRow = {
  id: string;
  source: MessageSource;
  status: MessageStatus;
  senderName: string;
  senderEmail: string | null;
  senderPhone: string | null;
  subject: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/** Public contact form. */
export async function createContactMessage(
  actor: Actor | null,
  input: ContactData,
): Promise<{ id: string }> {
  assertCan(actor, "create", { type: "message", senderUserId: actor?.userId ?? null });
  const [row] = await getDb()
    .insert(messages)
    .values({
      source: "contact_form",
      direction: "inbound",
      senderUserId: actor?.userId ?? null,
      senderName: input.name,
      senderEmail: input.email,
      senderPhone: input.phone ?? null,
      subject: input.subject,
      body: input.message,
    })
    .returning({ id: messages.id });
  if (!row) throw new Error("Insert returned no row");
  return row;
}

const selection = {
  id: messages.id,
  source: messages.source,
  status: messages.status,
  senderName: messages.senderName,
  senderEmail: messages.senderEmail,
  senderPhone: messages.senderPhone,
  subject: messages.subject,
  body: messages.body,
  createdAt: messages.createdAt,
  readAt: messages.readAt,
};

/** Clinic inbox (admin). Threads arrive in Phase 3; list root messages. */
export async function listInbox(actor: Actor, status: MessageStatus): Promise<MessageRow[]> {
  if (scopeFor(actor, "read", "message") !== "all") return [];
  const rows = await getDb()
    .select(selection)
    .from(messages)
    .where(and(eq(messages.status, status), isNull(messages.threadId), eq(messages.direction, "inbound")))
    .orderBy(desc(messages.createdAt))
    .limit(100);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
  }));
}

export async function countInboxByStatus(actor: Actor): Promise<Record<MessageStatus, number>> {
  const result: Record<MessageStatus, number> = { new: 0, read: 0, archived: 0 };
  if (scopeFor(actor, "read", "message") !== "all") return result;
  const rows = await getDb()
    .select({ status: messages.status, n: count() })
    .from(messages)
    .where(and(isNull(messages.threadId), eq(messages.direction, "inbound")))
    .groupBy(messages.status);
  for (const { status, n } of rows) result[status] = n;
  return result;
}

/** Number of unread messages for the inbox badge; null when not allowed. */
export async function countNewMessages(actor: Actor): Promise<number | null> {
  if (scopeFor(actor, "read", "message") !== "all") return null;
  const [row] = await getDb()
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.status, "new"), eq(messages.direction, "inbound")));
  return row?.n ?? 0;
}

export async function setMessageStatus(
  actor: Actor,
  id: string,
  status: MessageStatus,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: messages.id, status: messages.status, senderUserId: messages.senderUserId })
      .from(messages)
      .where(eq(messages.id, id))
      .for("update")
      .limit(1);
    if (!current) throw new NotFoundError("This message no longer exists.");
    assertCan(actor, "update", { type: "message", senderUserId: current.senderUserId });
    if (current.status === status) return;

    await tx
      .update(messages)
      .set({
        status,
        readAt: status === "new" ? null : sql`coalesce(${messages.readAt}, now())`,
        archivedAt: status === "archived" ? new Date() : null,
      })
      .where(eq(messages.id, id));

    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: `message.${status === "archived" ? "archive" : status === "read" ? "mark_read" : "mark_unread"}`,
      entityType: "message",
      entityId: id,
      before: { status: current.status },
      after: { status },
    });
  });
}

export async function searchMessages(actor: Actor, query: string): Promise<MessageRow[]> {
  if (scopeFor(actor, "read", "message") !== "all") return [];
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await getDb()
    .select(selection)
    .from(messages)
    .where(
      sql`(${messages.senderName} ilike ${pattern} or ${messages.senderEmail} ilike ${pattern} or ${messages.senderPhone} ilike ${pattern} or ${messages.subject} ilike ${pattern})`,
    )
    .orderBy(desc(messages.createdAt))
    .limit(25);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt?.toISOString() ?? null,
  }));
}
