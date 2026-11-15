import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, sql, type SQL } from "drizzle-orm";
import { appointments, staffProfiles, therapies } from "@/db/schema";
import type { AppointmentStatus, AppointmentType, PreferredTime } from "@/db/schema/enums";
import { assertCan, scopeFor, type Actor } from "@/lib/permissions";
import type { BookingData } from "@/lib/validation/public-forms";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { assertSlotFree } from "./scheduling";

export type QueueTab = "pending" | "approved" | "scheduled" | "closed";

const TAB_STATUSES: Record<QueueTab, AppointmentStatus[]> = {
  pending: ["pending"],
  approved: ["approved"],
  scheduled: ["scheduled"],
  closed: ["rejected", "cancelled", "completed"],
};

export type AppointmentRow = {
  id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  childName: string | null;
  childAgeYears: number | null;
  therapyName: string | null;
  therapySlug: string | null;
  preferredDate: string | null;
  preferredTime: PreferredTime;
  message: string | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  decisionNote: string | null;
  createdAt: string;
};

/** Public website: anyone may request; a signed-in parent is linked. */
export async function createAppointmentRequest(
  actor: Actor | null,
  input: BookingData,
): Promise<{ id: string }> {
  assertCan(actor, "create", {
    type: "appointment",
    requestedByUserId: actor?.userId ?? null,
    assignedStaffProfileId: null,
  });
  const db = getDb();

  let therapyId: string | null = null;
  if (input.therapySlug) {
    const [therapy] = await db
      .select({ id: therapies.id })
      .from(therapies)
      .where(and(eq(therapies.slug, input.therapySlug), eq(therapies.isActive, true)))
      .limit(1);
    therapyId = therapy?.id ?? null;
  }

  const [row] = await db
    .insert(appointments)
    .values({
      type: input.type,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      childName: input.childName ?? null,
      childAgeYears: input.childAgeYears ?? null,
      therapyId,
      preferredDate: input.preferredDate ?? null,
      preferredTime: input.preferredTime,
      message: input.message ?? null,
      requestedByUserId: actor?.role === "parent" ? actor.userId : null,
    })
    .returning({ id: appointments.id });

  if (!row) throw new Error("Insert returned no row");
  return row;
}

/** Row filter implementing the actor's read scope, or null for "nothing". */
function readFilter(actor: Actor): SQL | undefined | null {
  const scope = scopeFor(actor, "read", "appointment");
  if (scope === "all") return undefined;
  if (scope === "own") {
    if (actor.role === "parent") return eq(appointments.requestedByUserId, actor.userId);
    if (actor.staffProfileId) return eq(appointments.assignedStaffId, actor.staffProfileId);
  }
  return null;
}

const rowSelection = {
  id: appointments.id,
  type: appointments.type,
  status: appointments.status,
  contactName: appointments.contactName,
  contactEmail: appointments.contactEmail,
  contactPhone: appointments.contactPhone,
  childName: appointments.childName,
  childAgeYears: appointments.childAgeYears,
  therapyName: therapies.name,
  therapySlug: therapies.slug,
  preferredDate: appointments.preferredDate,
  preferredTime: appointments.preferredTime,
  message: appointments.message,
  assignedStaffId: appointments.assignedStaffId,
  assignedStaffName: staffProfiles.fullName,
  scheduledStart: appointments.scheduledStart,
  scheduledEnd: appointments.scheduledEnd,
  decisionNote: appointments.decisionNote,
  createdAt: appointments.createdAt,
};

function baseQuery() {
  return getDb()
    .select(rowSelection)
    .from(appointments)
    .leftJoin(therapies, eq(therapies.id, appointments.therapyId))
    .leftJoin(staffProfiles, eq(staffProfiles.id, appointments.assignedStaffId))
    .$dynamic();
}

type SelectedRow = Awaited<ReturnType<typeof baseQuery>>[number];

function toRow(row: SelectedRow): AppointmentRow {
  return {
    ...row,
    scheduledStart: row.scheduledStart?.toISOString() ?? null,
    scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const PAGE_SIZE = 100;

export async function listAppointments(
  actor: Actor,
  tab: QueueTab,
  type: AppointmentType | null,
): Promise<AppointmentRow[]> {
  const filter = readFilter(actor);
  if (filter === null) return [];

  const conditions = [inArray(appointments.status, TAB_STATUSES[tab]), filter];
  if (type) conditions.push(eq(appointments.type, type));

  const order =
    tab === "scheduled"
      ? [asc(appointments.scheduledStart)]
      : tab === "closed"
        ? [desc(appointments.updatedAt)]
        : [asc(appointments.createdAt)]; // queue: oldest request first

  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(...order)
    .limit(PAGE_SIZE);

  return rows.map(toRow);
}

export async function countAppointmentsByTab(
  actor: Actor,
): Promise<Record<QueueTab, number>> {
  const result: Record<QueueTab, number> = { pending: 0, approved: 0, scheduled: 0, closed: 0 };
  const filter = readFilter(actor);
  if (filter === null) return result;

  const rows = await getDb()
    .select({ status: appointments.status, n: count() })
    .from(appointments)
    .where(filter)
    .groupBy(appointments.status);

  for (const { status, n } of rows) {
    const tab = (Object.keys(TAB_STATUSES) as QueueTab[]).find((t) =>
      TAB_STATUSES[t].includes(status),
    );
    if (tab) result[tab] += n;
  }
  return result;
}

/** Scheduled appointments between two instants, within the actor's scope. */
export async function listScheduledBetween(
  actor: Actor,
  from: Date,
  to: Date,
): Promise<AppointmentRow[]> {
  const filter = readFilter(actor);
  if (filter === null) return [];
  const rows = await baseQuery()
    .where(
      and(
        eq(appointments.status, "scheduled"),
        gte(appointments.scheduledStart, from),
        lt(appointments.scheduledStart, to),
        filter,
      ),
    )
    .orderBy(asc(appointments.scheduledStart))
    .limit(PAGE_SIZE);
  return rows.map(toRow);
}

/* ---------- Status transitions (admin) ---------- */

export type AppointmentTransition = "approve" | "schedule" | "reject" | "cancel" | "complete";

const ALLOWED_FROM: Record<AppointmentTransition, AppointmentStatus[]> = {
  approve: ["pending"],
  schedule: ["pending", "approved", "scheduled"],
  reject: ["pending", "approved"],
  cancel: ["approved", "scheduled"],
  complete: ["scheduled"],
};

const TARGET: Record<AppointmentTransition, AppointmentStatus> = {
  approve: "approved",
  schedule: "scheduled",
  reject: "rejected",
  cancel: "cancelled",
  complete: "completed",
};

type TransitionInput = {
  id: string;
  note?: string;
  schedule?: { start: Date; end: Date; assignedStaffId: string | null };
};

export async function transitionAppointment(
  actor: Actor,
  transition: AppointmentTransition,
  input: TransitionInput,
): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, input.id))
      .for("update")
      .limit(1);
    if (!current) throw new NotFoundError("This request no longer exists.");

    assertCan(actor, "update", {
      type: "appointment",
      requestedByUserId: current.requestedByUserId,
      assignedStaffProfileId: current.assignedStaffId,
    });

    if (!ALLOWED_FROM[transition].includes(current.status)) {
      throw new ConflictError(
        `This request is already ${current.status}. Refresh the list to see its latest state.`,
      );
    }

    if (transition === "schedule") {
      if (!input.schedule) throw new Error("schedule details missing");
      const staffId = input.schedule.assignedStaffId;
      if (staffId) {
        const [staff] = await tx
          .select({ id: staffProfiles.id })
          .from(staffProfiles)
          .where(
            and(
              eq(staffProfiles.id, staffId),
              isNull(staffProfiles.archivedAt),
              ne(staffProfiles.staffType, "labour"),
            ),
          )
          .limit(1);
        if (!staff) throw new ConflictError("The selected therapist is not available.");
        await assertSlotFree(tx, {
          staffProfileId: staffId,
          start: input.schedule.start,
          end: input.schedule.end,
          excludeAppointmentId: current.id,
        });
      }
    }

    const now = new Date();
    const changes = {
      status: TARGET[transition],
      decisionNote: input.note ?? current.decisionNote,
      decidedByUserId: actor.userId,
      decidedAt: now,
      ...(input.schedule && {
        scheduledStart: input.schedule.start,
        scheduledEnd: input.schedule.end,
        assignedStaffId: input.schedule.assignedStaffId,
      }),
    };

    await tx.update(appointments).set(changes).where(eq(appointments.id, current.id));

    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: `appointment.${transition}`,
      entityType: "appointment",
      entityId: current.id,
      before: {
        status: current.status,
        scheduledStart: current.scheduledStart,
        assignedStaffId: current.assignedStaffId,
        decisionNote: current.decisionNote,
      },
      after: {
        status: changes.status,
        scheduledStart: changes.scheduledStart ?? current.scheduledStart,
        assignedStaffId: changes.assignedStaffId ?? current.assignedStaffId,
        decisionNote: changes.decisionNote,
      },
    });
  });
}

/** Staff who can be assigned to an appointment (doctors and specialists). */
export async function listAssignableStaff(
  actor: Actor,
): Promise<{ id: string; fullName: string; title: string | null }[]> {
  if (scopeFor(actor, "update", "appointment") !== "all") return [];
  return getDb()
    .select({ id: staffProfiles.id, fullName: staffProfiles.fullName, title: staffProfiles.title })
    .from(staffProfiles)
    .where(and(isNull(staffProfiles.archivedAt), ne(staffProfiles.staffType, "labour")))
    .orderBy(asc(staffProfiles.fullName));
}

/** For the global search box (name, email or phone). */
export async function searchAppointments(actor: Actor, query: string): Promise<AppointmentRow[]> {
  const filter = readFilter(actor);
  if (filter === null) return [];
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await baseQuery()
    .where(
      and(
        filter,
        sql`(${appointments.contactName} ilike ${pattern} or ${appointments.contactEmail} ilike ${pattern} or ${appointments.contactPhone} ilike ${pattern} or ${appointments.childName} ilike ${pattern})`,
      ),
    )
    .orderBy(desc(appointments.createdAt))
    .limit(25);
  return rows.map(toRow);
}
