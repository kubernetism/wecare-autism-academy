import "server-only";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { admissions, enrollments, patients } from "@/db/schema";
import type { AdmissionKind } from "@/db/schema/enums";
import { scopeFor, type Actor } from "@/lib/permissions";
import { dayBounds } from "@/lib/time";
import { getDb } from "../db";
import { env } from "../env";
import { countAppointmentsByTab, listScheduledBetween, type AppointmentRow } from "./appointments";
import { countNewMessages } from "./messages";
import { listPatients, type PatientListRow } from "./patients";
import { listSessions, type SessionRow } from "./sessions";
import { countActiveStaff } from "./staff";

/**
 * A dashboard figure: a real count, or a module that is not built yet. We
 * never show a made-up number.
 */
export type StatValue = { kind: "count"; value: number } | { kind: "unavailable"; phase: 3 };

export type RecentAdmission = { patientId: string; name: string; trackingId: string; kind: AdmissionKind; effectiveOn: string };

export type DashboardData = {
  isAdmin: boolean;
  timeZone: string;
  stats: { key: string; label: string; href?: string; value: StatValue }[];
  todaySessions: SessionRow[];
  todayAppointments: AppointmentRow[];
  pendingRequests: number;
  myPatients: PatientListRow[];
  recentAdmissions: RecentAdmission[];
};

export async function getDashboard(actor: Actor): Promise<DashboardData> {
  const timeZone = env.CLINIC_TIME_ZONE;
  const { start, end } = dayBounds(new Date(), timeZone);
  const isAdmin = scopeFor(actor, "read", "dashboard") === "all";
  const db = getDb();

  const [todayAppointments, counts, newMessages, staffCount, sessions] = await Promise.all([
    listScheduledBetween(actor, start, end),
    countAppointmentsByTab(actor),
    countNewMessages(actor),
    countActiveStaff(actor),
    listSessions(actor, {
      from: start,
      to: end,
      // Staff: the sessions they run (staff without a profile see none).
      staffProfileId: isAdmin ? undefined : (actor.staffProfileId ?? undefined),
      pageSize: 100,
    }),
  ]);

  if (isAdmin) {
    const [[activePatients], [activeTherapies], recent] = await Promise.all([
      db.select({ n: count() }).from(patients).where(and(eq(patients.status, "active"), isNull(patients.deletedAt))),
      db.select({ n: count() }).from(enrollments).where(inArray(enrollments.status, ["active", "on_hold"])),
      db
        .select({
          patientId: patients.id,
          name: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
          trackingId: patients.trackingId,
          kind: admissions.kind,
          effectiveOn: admissions.effectiveOn,
        })
        .from(admissions)
        .innerJoin(patients, eq(patients.id, admissions.patientId))
        .where(and(inArray(admissions.kind, ["admit", "readmit"]), isNull(patients.deletedAt)))
        .orderBy(sql`${admissions.createdAt} desc`)
        .limit(5),
    ]);
    return {
      isAdmin,
      timeZone,
      todaySessions: sessions.rows,
      todayAppointments,
      pendingRequests: counts.pending,
      myPatients: [],
      recentAdmissions: recent,
      stats: [
        { key: "patients", label: "Active patients", href: "/app/patients", value: { kind: "count", value: activePatients?.n ?? 0 } },
        { key: "therapies", label: "Active therapies", href: "/app/patients", value: { kind: "count", value: activeTherapies?.n ?? 0 } },
        { key: "staff", label: "Staff", href: "/app/staff", value: { kind: "count", value: staffCount ?? 0 } },
        { key: "requests", label: "Pending requests", href: "/app/appointments", value: { kind: "count", value: counts.pending } },
        { key: "messages", label: "New messages", href: "/app/inbox", value: { kind: "count", value: newMessages ?? 0 } },
        { key: "events", label: "Events (total / active)", value: { kind: "unavailable", phase: 3 } },
        { key: "expenses", label: "Expenses this month", value: { kind: "unavailable", phase: 3 } },
        { key: "invoices", label: "Pending invoices", value: { kind: "unavailable", phase: 3 } },
      ],
    };
  }

  const myPatients = await listPatients(actor, { status: "active", page: 1, pageSize: 50 });
  return {
    isAdmin,
    timeZone,
    todaySessions: sessions.rows,
    todayAppointments,
    pendingRequests: 0,
    myPatients: myPatients.rows,
    recentAdmissions: [],
    stats: [
      { key: "sessions", label: "My sessions today", href: "/app/calendar", value: { kind: "count", value: sessions.total } },
      { key: "appointments", label: "My appointments today", href: "/app/appointments?tab=scheduled", value: { kind: "count", value: todayAppointments.length } },
      { key: "patients", label: "My assigned patients", href: "/app/patients", value: { kind: "count", value: myPatients.total } },
      { key: "upcoming", label: "My scheduled appointments", href: "/app/appointments?tab=scheduled", value: { kind: "count", value: counts.scheduled } },
    ],
  };
}
