import "server-only";
import { and, asc, eq, gte, isNull, lt, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { appointments, enrollments, patients, staffProfiles, therapies, therapySessions } from "@/db/schema";
import type { AppointmentType, SessionStatus } from "@/db/schema/enums";
import { scopeFor, type Actor } from "@/lib/permissions";
import { getDb } from "../db";

export type CalendarEvent = {
  id: string;
  kind: "session" | "appointment";
  staffProfileId: string;
  start: string;
  end: string;
  title: string;
  subtitle: string;
  status: SessionStatus | "scheduled";
  patientId: string | null;
  appointmentType?: AppointmentType;
};

export type CalendarData = { therapists: { id: string; name: string }[]; events: CalendarEvent[] };

/**
 * Sessions and scheduled appointments between two instants, one column per
 * therapist. Admins see every therapist; staff see only their own column.
 */
export async function calendarRange(actor: Actor, from: Date, to: Date): Promise<CalendarData> {
  const all = scopeFor(actor, "read", "therapySession") === "all";
  if (!all && !actor.staffProfileId) return { therapists: [], events: [] };
  const own = actor.staffProfileId ?? "";
  const db = getDb();

  const staffFilter: SQL | undefined = all ? undefined : eq(staffProfiles.id, own);
  const therapists = await db
    .select({ id: staffProfiles.id, name: staffProfiles.fullName })
    .from(staffProfiles)
    .where(and(isNull(staffProfiles.archivedAt), ne(staffProfiles.staffType, "labour"), staffFilter))
    .orderBy(asc(staffProfiles.fullName));

  const sessions = await db
    .select({
      id: therapySessions.id,
      staffProfileId: therapySessions.staffProfileId,
      start: therapySessions.scheduledStart,
      end: therapySessions.scheduledEnd,
      status: therapySessions.status,
      patientId: therapySessions.patientId,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      therapyName: therapies.shortName,
    })
    .from(therapySessions)
    .innerJoin(patients, eq(patients.id, therapySessions.patientId))
    .innerJoin(enrollments, eq(enrollments.id, therapySessions.enrollmentId))
    .innerJoin(therapies, eq(therapies.id, enrollments.therapyId))
    .where(
      and(
        isNull(therapySessions.deletedAt),
        notInArray(therapySessions.status, ["cancelled"]),
        gte(therapySessions.scheduledStart, from),
        lt(therapySessions.scheduledStart, to),
        all ? undefined : eq(therapySessions.staffProfileId, own),
      ),
    );

  const appts = await db
    .select({
      id: appointments.id,
      staffProfileId: appointments.assignedStaffId,
      start: appointments.scheduledStart,
      end: appointments.scheduledEnd,
      type: appointments.type,
      contactName: appointments.contactName,
      childName: appointments.childName,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "scheduled"),
        sql`${appointments.assignedStaffId} is not null`,
        gte(appointments.scheduledStart, from),
        lt(appointments.scheduledStart, to),
        all ? undefined : eq(appointments.assignedStaffId, own),
      ),
    );

  const events: CalendarEvent[] = [
    ...sessions.map((s) => ({
      id: s.id,
      kind: "session" as const,
      staffProfileId: s.staffProfileId,
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      title: s.patientName,
      subtitle: s.therapyName,
      status: s.status,
      patientId: s.patientId,
    })),
    ...appts
      .filter((a): a is typeof a & { staffProfileId: string; start: Date } => Boolean(a.staffProfileId && a.start))
      .map((a) => ({
        id: a.id,
        kind: "appointment" as const,
        staffProfileId: a.staffProfileId,
        start: a.start.toISOString(),
        end: (a.end ?? new Date(a.start.getTime() + 3_600_000)).toISOString(),
        title: a.childName ?? a.contactName,
        subtitle: a.type === "demo_session" ? "Demo session" : a.type === "introduction" ? "Introduction" : "Appointment",
        status: "scheduled" as const,
        patientId: null,
        appointmentType: a.type,
      })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return { therapists: therapists.map((t) => ({ id: t.id, name: t.name })), events };
}
