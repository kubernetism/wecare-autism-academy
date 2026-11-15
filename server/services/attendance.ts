import "server-only";
import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { attendancePatient, attendanceStaff, staffProfiles, therapySessions } from "@/db/schema";
import type { PatientAttendance, SessionStatus, StaffAttendance, StaffType } from "@/db/schema/enums";
import { assertCan, scopeFor, type Actor } from "@/lib/permissions";
import { ymdInZone, zonedTimeToUtc } from "@/lib/time";
import type { patientAttendanceSchema, staffAttendanceSchema } from "@/lib/validation/clinical";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { env } from "../env";
import { ConflictError, NotFoundError } from "../errors";
import { loadPatientScope } from "./patient-access";

const SESSION_STATUS_FOR: Record<PatientAttendance, SessionStatus> = { present: "completed", absent: "missed", cancelled: "cancelled" };

/** Admin, or the therapist running the session: mark patient attendance. Drives session status (and progress). */
export async function markPatientAttendance(actor: Actor, input: z.output<typeof patientAttendanceSchema>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [session] = await tx.select().from(therapySessions).where(and(eq(therapySessions.id, input.sessionId), isNull(therapySessions.deletedAt))).for("update").limit(1);
    if (!session) throw new NotFoundError("This session does not exist.");
    const scope = await loadPatientScope(tx, session.patientId);
    if (!scope) throw new NotFoundError("This session does not exist.");
    assertCan(actor, "update", { type: "attendance", kind: "patient", staffProfileId: session.staffProfileId, patient: scope });
    const [before] = await tx.select().from(attendancePatient).where(eq(attendancePatient.sessionId, session.id)).limit(1);
    await tx
      .insert(attendancePatient)
      .values({ sessionId: session.id, patientId: session.patientId, status: input.status, reason: input.reason ?? null, markedByUserId: actor.userId })
      .onConflictDoUpdate({
        target: attendancePatient.sessionId,
        set: { status: input.status, reason: input.reason ?? null, markedByUserId: actor.userId, markedAt: new Date() },
      });
    await tx.update(therapySessions).set({ status: SESSION_STATUS_FOR[input.status] }).where(eq(therapySessions.id, session.id));
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "attendance.patient",
      entityType: "therapy_session",
      entityId: session.id,
      before: before ? { status: before.status, reason: before.reason } : null,
      after: { status: input.status, reason: input.reason ?? null },
    });
  });
}

export type StaffDayRow = {
  staffProfileId: string;
  fullName: string;
  staffType: StaffType;
  status: StaffAttendance | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
};

/** Admin: every active person (including support staff) with their attendance for one day. */
export async function staffDay(actor: Actor, day: string): Promise<StaffDayRow[]> {
  if (scopeFor(actor, "read", "attendance") !== "all") return [];
  const rows = await getDb()
    .select({
      staffProfileId: staffProfiles.id,
      fullName: staffProfiles.fullName,
      staffType: staffProfiles.staffType,
      status: attendanceStaff.status,
      checkInAt: attendanceStaff.checkInAt,
      checkOutAt: attendanceStaff.checkOutAt,
      note: attendanceStaff.note,
    })
    .from(staffProfiles)
    .leftJoin(attendanceStaff, and(eq(attendanceStaff.staffProfileId, staffProfiles.id), eq(attendanceStaff.day, day)))
    .where(isNull(staffProfiles.archivedAt))
    .orderBy(asc(staffProfiles.staffType), asc(staffProfiles.fullName));
  return rows.map((r) => ({ ...r, checkInAt: r.checkInAt?.toISOString() ?? null, checkOutAt: r.checkOutAt?.toISOString() ?? null }));
}

function atTime(day: string, hhmm: string | undefined): Date | null {
  if (!hhmm) return null;
  const [year, month, d] = day.split("-").map(Number) as [number, number, number];
  const [hour, minute] = hhmm.split(":").map(Number) as [number, number];
  return zonedTimeToUtc({ year, month, day: d, hour, minute }, env.CLINIC_TIME_ZONE);
}

/** Admin: mark a person's day (present with times, absent, or leave). */
export async function markStaffAttendance(actor: Actor, input: z.output<typeof staffAttendanceSchema>): Promise<void> {
  assertCan(actor, "update", { type: "attendance", kind: "staff", staffProfileId: input.staffProfileId, patient: null });
  if (actor.role !== "admin") throw new ConflictError("Use the check-in and check-out buttons for your own attendance.");
  const checkInAt = input.status === "present" ? atTime(input.day, input.checkIn) : null;
  const checkOutAt = input.status === "present" ? atTime(input.day, input.checkOut) : null;
  if (checkInAt && checkOutAt && checkOutAt < checkInAt) throw new ConflictError("Check-out cannot be before check-in.");
  await getDb().transaction(async (tx) => {
    const [staff] = await tx.select({ id: staffProfiles.id }).from(staffProfiles).where(eq(staffProfiles.id, input.staffProfileId)).limit(1);
    if (!staff) throw new NotFoundError("This staff member does not exist.");
    const values = { status: input.status, checkInAt, checkOutAt, note: input.note ?? null, markedByUserId: actor.userId };
    await tx
      .insert(attendanceStaff)
      .values({ staffProfileId: input.staffProfileId, day: input.day, ...values })
      .onConflictDoUpdate({ target: [attendanceStaff.staffProfileId, attendanceStaff.day], set: values });
    await writeAudit(tx, { actorUserId: actor.userId, action: "attendance.staff", entityType: "staff_profile", entityId: input.staffProfileId, after: { day: input.day, ...values } });
  });
}

/** Staff: check yourself in or out today. */
export async function selfCheck(actor: Actor, direction: "in" | "out"): Promise<void> {
  if (!actor.staffProfileId) throw new ConflictError("Your account has no staff profile.");
  const staffProfileId = actor.staffProfileId;
  assertCan(actor, "update", { type: "attendance", kind: "staff", staffProfileId, patient: null });
  const day = ymdInZone(new Date(), env.CLINIC_TIME_ZONE);
  const now = new Date();
  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(attendanceStaff)
      .where(and(eq(attendanceStaff.staffProfileId, staffProfileId), eq(attendanceStaff.day, day)))
      .for("update")
      .limit(1);
    if (direction === "in") {
      if (row?.checkInAt) throw new ConflictError("You have already checked in today.");
      await tx
        .insert(attendanceStaff)
        .values({ staffProfileId, day, status: "present", checkInAt: now, markedByUserId: actor.userId })
        .onConflictDoUpdate({ target: [attendanceStaff.staffProfileId, attendanceStaff.day], set: { status: "present", checkInAt: now, markedByUserId: actor.userId } });
    } else {
      if (!row?.checkInAt) throw new ConflictError("Check in first.");
      if (row.checkOutAt) throw new ConflictError("You have already checked out today.");
      await tx.update(attendanceStaff).set({ checkOutAt: now }).where(eq(attendanceStaff.id, row.id));
    }
    await writeAudit(tx, { actorUserId: actor.userId, action: `attendance.check_${direction}`, entityType: "staff_profile", entityId: staffProfileId, after: { day, at: now } });
  });
}

export type StaffMonthRow = { day: string; status: StaffAttendance; checkInAt: string | null; checkOutAt: string | null; note: string | null };

/** One person's attendance for a month (YYYY-MM). Staff may only read their own. */
export async function staffMonth(actor: Actor, staffProfileId: string, month: string): Promise<StaffMonthRow[]> {
  assertCan(actor, "read", { type: "attendance", kind: "staff", staffProfileId, patient: null });
  const [y, m] = month.split("-").map(Number) as [number, number];
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const rows = await getDb()
    .select({ day: attendanceStaff.day, status: attendanceStaff.status, checkInAt: attendanceStaff.checkInAt, checkOutAt: attendanceStaff.checkOutAt, note: attendanceStaff.note })
    .from(attendanceStaff)
    .where(and(eq(attendanceStaff.staffProfileId, staffProfileId), gte(attendanceStaff.day, from), lt(attendanceStaff.day, to)))
    .orderBy(asc(attendanceStaff.day));
  return rows.map((r) => ({ ...r, checkInAt: r.checkInAt?.toISOString() ?? null, checkOutAt: r.checkOutAt?.toISOString() ?? null }));
}

/** Count of present days this month for summaries. */
export async function presentDays(staffProfileId: string, month: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(attendanceStaff)
    .where(and(eq(attendanceStaff.staffProfileId, staffProfileId), eq(attendanceStaff.status, "present"), sql`to_char(${attendanceStaff.day}, 'YYYY-MM') = ${month}`));
  return row?.n ?? 0;
}
