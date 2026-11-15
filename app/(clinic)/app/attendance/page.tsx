import { AttendanceBoard } from "@/components/clinic/attendance-board";
import { PageHeader } from "@/components/clinic/page-header";
import { scopeFor } from "@/lib/permissions";
import { dayBounds, ymdInZone, zonedMidnight } from "@/lib/time";
import { env } from "@/server/env";
import { staffDay, staffMonth } from "@/server/services/attendance";
import { listSessions } from "@/server/services/sessions";
import { requireUser } from "@/server/session";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/app/attendance">) {
  const user = await requireUser(["admin", "staff"], "/app/attendance");
  const tz = env.CLINIC_TIME_ZONE;
  const sp = await searchParams;
  const today = ymdInZone(new Date(), tz);
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const isAdmin = scopeFor(user, "read", "attendance") === "all";
  const { start, end } = dayBounds(zonedMidnight(day, tz), tz);

  const [staffRows, sessions, myMonth] = await Promise.all([
    isAdmin ? staffDay(user, day) : Promise.resolve([]),
    listSessions(user, { from: start, to: end, staffProfileId: isAdmin ? undefined : (user.staffProfileId ?? undefined), page: 1, pageSize: 100, order: "asc" }),
    user.staffProfileId ? staffMonth(user, user.staffProfileId, month) : Promise.resolve([]),
  ]);
  let myToday = null;
  if (user.staffProfileId) {
    const rows = month === today.slice(0, 7) ? myMonth : await staffMonth(user, user.staffProfileId, today.slice(0, 7));
    myToday = rows.find((r) => r.day === today) ?? null;
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description={isAdmin ? "Mark staff attendance for a day, and patient attendance for each session." : "Check in and out, mark attendance for your sessions, and see your month."}
      />
      <AttendanceBoard
        isAdmin={isAdmin}
        day={day}
        today={today}
        month={month}
        staffRows={staffRows}
        sessions={sessions.rows}
        myMonth={myMonth}
        myToday={myToday}
        hasProfile={Boolean(user.staffProfileId)}
        staffProfileId={user.staffProfileId}
        timeZone={tz}
      />
    </>
  );
}
