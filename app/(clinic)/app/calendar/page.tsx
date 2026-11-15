import { ClinicCalendar } from "@/components/clinic/clinic-calendar";
import { PageHeader } from "@/components/clinic/page-header";
import { scopeFor } from "@/lib/permissions";
import { ymdInZone, zonedMidnight } from "@/lib/time";
import { env } from "@/server/env";
import { calendarRange } from "@/server/services/calendar";
import { openEnrollmentOptions } from "@/server/services/enrollments";
import { requireUser } from "@/server/session";

export const metadata = { title: "Calendar" };

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `ymd`. */
function weekStart(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return addDays(ymd, -((dow + 6) % 7));
}

export default async function CalendarPage({ searchParams }: PageProps<"/app/calendar">) {
  const user = await requireUser(["admin", "staff"], "/app/calendar");
  const tz = env.CLINIC_TIME_ZONE;
  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "day";
  const today = ymdInZone(new Date(), tz);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const first = view === "week" ? weekStart(date) : date;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(first, i));
  const canSchedule = scopeFor(user, "create", "therapySession") === "all";

  const [data, enrollments] = await Promise.all([
    calendarRange(user, zonedMidnight(first, tz), zonedMidnight(addDays(first, days.length), tz)),
    canSchedule ? openEnrollmentOptions(user) : Promise.resolve([]),
  ]);
  const staffFilter = typeof sp.staff === "string" && data.therapists.some((t) => t.id === sp.staff) ? sp.staff : undefined;

  return (
    <>
      <PageHeader
        title="Calendar"
        description={canSchedule ? "Therapy sessions and appointment visits. Click an empty slot to schedule a session." : "Your sessions and appointment visits."}
      />
      <ClinicCalendar
        view={view}
        date={date}
        today={today}
        days={days}
        therapists={data.therapists}
        events={data.events}
        staffFilter={staffFilter}
        canSchedule={canSchedule}
        enrollments={enrollments}
        timeZone={tz}
      />
    </>
  );
}
