"use client";

import { Badge, Calendar, Flex, Statistic, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STAFF_ATTENDANCE, type StaffAttendance } from "@/db/schema/enums";
import { STAFF_ATTENDANCE_LABEL } from "@/lib/labels";
import { formatTime } from "@/lib/time";
import type { StaffMonthRow } from "@/server/services/attendance";

const BADGE: Record<StaffAttendance, "success" | "error" | "warning"> = { present: "success", absent: "error", leave: "warning" };

/** One person's attendance for a month. The month lives in the URL (?month=YYYY-MM). */
export function AttendanceMonth({ rows, month, timeZone }: { rows: StaffMonthRow[]; month: string; timeZone: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const value = dayjs(`${month}-01`);

  function changeMonth(d: Dayjs) {
    const next = new URLSearchParams(params.toString());
    next.set("month", d.format("YYYY-MM"));
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <>
      <Flex wrap gap={32} style={{ marginBottom: 8 }}>
        {STAFF_ATTENDANCE.map((s) => (
          <Statistic key={s} title={STAFF_ATTENDANCE_LABEL[s]} value={rows.filter((r) => r.status === s).length} suffix="days" />
        ))}
      </Flex>
      <Calendar
        fullscreen={false}
        value={value}
        mode="month"
        onPanelChange={(d) => changeMonth(d)}
        onSelect={(d, info) => {
          if (info.source === "month" || info.source === "year") changeMonth(d);
        }}
        fullCellRender={(d, info) => {
          if (info.type !== "date") return info.originNode;
          const row = d.format("YYYY-MM") === month ? byDay.get(d.format("YYYY-MM-DD")) : undefined;
          const label = row ? `${STAFF_ATTENDANCE_LABEL[row.status]}${row.checkInAt ? `, in ${formatTime(row.checkInAt, timeZone)}` : ""}${row.checkOutAt ? `, out ${formatTime(row.checkOutAt, timeZone)}` : ""}` : undefined;
          return (
            <div className="ant-picker-cell-inner" title={label} aria-label={label ? `${d.format("D MMMM")}: ${label}` : undefined}>
              <div>{d.date()}</div>
              {row ? <Badge status={BADGE[row.status]} /> : null}
            </div>
          );
        }}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Green: present. Red: absent. Orange: on leave. Hover a day for check-in and check-out times.
      </Typography.Paragraph>
    </>
  );
}
