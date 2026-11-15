import { AppointmentQueue } from "@/components/clinic/appointment-queue";
import { PageHeader } from "@/components/clinic/page-header";
import { APPOINTMENT_TYPES, type AppointmentType } from "@/db/schema/enums";
import { scopeFor } from "@/lib/permissions";
import { env } from "@/server/env";
import {
  countAppointmentsByTab,
  listAppointments,
  listAssignableStaff,
  type QueueTab,
} from "@/server/services/appointments";
import { requireUser } from "@/server/session";

export const metadata = { title: "Appointments" };

const TABS: QueueTab[] = ["pending", "approved", "scheduled", "closed"];

function parseTab(value: unknown): QueueTab {
  return TABS.includes(value as QueueTab) ? (value as QueueTab) : "pending";
}

function parseType(value: unknown): AppointmentType | null {
  return APPOINTMENT_TYPES.includes(value as AppointmentType) ? (value as AppointmentType) : null;
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/app/appointments">) {
  const user = await requireUser(["admin", "staff"], "/app/appointments");
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const type = parseType(params.type);
  const canManage = scopeFor(user, "update", "appointment") === "all";

  const [rows, counts, staff] = await Promise.all([
    listAppointments(user, tab, type),
    countAppointmentsByTab(user),
    listAssignableStaff(user),
  ]);

  return (
    <>
      <PageHeader
        title="Appointments"
        description={
          canManage
            ? "Requests from the website for appointments, demo sessions and introductions. Approve, schedule or decline each one."
            : "Appointments assigned to you."
        }
      />
      <AppointmentQueue
        key={`${tab}-${type ?? "all"}`}
        rows={rows}
        counts={counts}
        staff={staff}
        tab={tab}
        type={type}
        canManage={canManage}
        timeZone={env.CLINIC_TIME_ZONE}
      />
    </>
  );
}
