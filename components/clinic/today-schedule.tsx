"use client";

import { Empty, Table, Tag } from "antd";
import Link from "next/link";
import { APPOINTMENT_TYPE_LABEL, SESSION_STATUS_LABEL, SESSION_STATUS_TAG } from "@/lib/labels";
import { formatTime } from "@/lib/time";
import type { AppointmentRow } from "@/server/services/appointments";
import type { SessionRow } from "@/server/services/sessions";

type Item = {
  key: string;
  start: string;
  who: React.ReactNode;
  therapy: string;
  therapist: string;
  kind: React.ReactNode;
};

/** Today's therapy sessions and appointment visits, in time order. */
export function TodaySchedule({
  sessions,
  appointments,
  timeZone,
  emptyText,
}: {
  sessions: SessionRow[];
  appointments: AppointmentRow[];
  timeZone: string;
  emptyText: string;
}) {
  const items: Item[] = [
    ...sessions.map((s) => ({
      key: `s-${s.id}`,
      start: s.scheduledStart,
      who: <Link href={`/app/sessions/${s.id}`}>{s.patientName}</Link>,
      therapy: s.therapyName,
      therapist: s.staffName,
      kind: <Tag color={SESSION_STATUS_TAG[s.status]}>{`Session, ${SESSION_STATUS_LABEL[s.status].toLowerCase()}`}</Tag>,
    })),
    ...appointments
      .filter((a) => a.scheduledStart)
      .map((a) => ({
        key: `a-${a.id}`,
        start: a.scheduledStart ?? "",
        who: <Link href="/app/appointments?tab=scheduled">{a.childName ?? a.contactName}</Link>,
        therapy: a.therapyName ?? "Not chosen",
        therapist: a.assignedStaffName ?? "Not assigned",
        kind: <Tag>{APPOINTMENT_TYPE_LABEL[a.type]}</Tag>,
      })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Table<Item>
      size="small"
      rowKey="key"
      pagination={false}
      dataSource={items}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
      scroll={{ x: 520 }}
      columns={[
        { title: "Time", dataIndex: "start", width: 80, render: (v: string) => formatTime(v, timeZone) },
        { title: "Who", dataIndex: "who" },
        { title: "Therapy", dataIndex: "therapy" },
        { title: "Therapist", dataIndex: "therapist" },
        { title: "Type", dataIndex: "kind" },
      ]}
    />
  );
}
