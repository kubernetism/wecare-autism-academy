"use client";

import { Flex, Segmented, Select, Table, Tag } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { SESSION_STATUSES, type RecordStatus, type SessionStatus } from "@/db/schema/enums";
import { RECORD_STATUS_LABEL, RECORD_STATUS_TAG, SESSION_STATUS_LABEL, SESSION_STATUS_TAG } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import type { SessionRow } from "@/server/services/sessions";

export function SessionsList({
  result,
  view,
  status,
  page,
  timeZone,
}: {
  result: { rows: SessionRow[]; total: number };
  view: "upcoming" | "past";
  status?: SessionStatus;
  page: number;
  timeZone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, startTransition] = useTransition();
  const go = (next: { view?: string; status?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    params.set("view", next.view ?? view);
    const s = next.status === undefined ? status : next.status;
    if (s) params.set("status", s);
    if ((next.page ?? 1) > 1) params.set("page", String(next.page));
    startTransition(() => router.push(`${pathname}?${params}`));
  };

  return (
    <>
      <Flex wrap gap={12} style={{ marginBottom: 16 }}>
        <Segmented value={view} onChange={(v) => go({ view: v as string, page: 1 })} options={[{ label: "Upcoming", value: "upcoming" }, { label: "Past", value: "past" }]} />
        <Select
          allowClear
          placeholder="Any status"
          value={status}
          style={{ width: 180 }}
          onChange={(v) => go({ status: v ?? null, page: 1 })}
          options={SESSION_STATUSES.map((s) => ({ value: s, label: SESSION_STATUS_LABEL[s] }))}
        />
      </Flex>
      <Table<SessionRow>
        rowKey="id"
        loading={loading}
        dataSource={result.rows}
        scroll={{ x: 960 }}
        locale={{ emptyText: view === "upcoming" ? "No upcoming sessions." : "No past sessions." }}
        pagination={{ current: page, pageSize: 20, total: result.total, showSizeChanger: false, onChange: (p) => go({ page: p }) }}
        columns={[
          { title: "When", dataIndex: "scheduledStart", width: 210, render: (v: string) => formatDateTime(v, timeZone) },
          { title: "Patient", dataIndex: "patientName", render: (v: string, r) => <Link href={`/app/patients/${r.patientId}`}>{`${v} (${r.trackingId})`}</Link> },
          { title: "Therapy", dataIndex: "therapyName" },
          { title: "Therapist", dataIndex: "staffName" },
          { title: "Status", dataIndex: "status", render: (v: SessionStatus) => <Tag color={SESSION_STATUS_TAG[v]}>{SESSION_STATUS_LABEL[v]}</Tag> },
          { title: "Record", dataIndex: "recordStatus", render: (v: RecordStatus, r) => <Link href={`/app/sessions/${r.id}`}><Tag color={RECORD_STATUS_TAG[v]}>{RECORD_STATUS_LABEL[v]}</Tag></Link> },
        ]}
      />
    </>
  );
}
