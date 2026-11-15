"use client";

import { Empty, Table, Tag } from "antd";
import Link from "next/link";
import type { AdmissionKind, PatientStatus } from "@/db/schema/enums";
import { ADMISSION_KIND_LABEL, PATIENT_STATUS_LABEL, PATIENT_STATUS_TAG } from "@/lib/labels";
import { formatDate } from "@/lib/time";
import type { RecentAdmission } from "@/server/services/dashboard";
import type { PatientListRow } from "@/server/services/patients";

export function RecentAdmissions({ rows }: { rows: RecentAdmission[] }) {
  return (
    <Table<RecentAdmission>
      size="small"
      rowKey={(r) => `${r.patientId}-${r.effectiveOn}-${r.kind}`}
      pagination={false}
      dataSource={rows}
      scroll={{ x: 420 }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No admissions yet." /> }}
      columns={[
        { title: "Patient", dataIndex: "name", render: (v: string, r) => <Link href={`/app/patients/${r.patientId}`}>{v}</Link> },
        { title: "Tracking ID", dataIndex: "trackingId" },
        { title: "Event", dataIndex: "kind", render: (v: AdmissionKind) => ADMISSION_KIND_LABEL[v] },
        { title: "Date", dataIndex: "effectiveOn", render: (v: string) => formatDate(v) },
      ]}
    />
  );
}

export function MyPatients({ rows }: { rows: PatientListRow[] }) {
  return (
    <Table<PatientListRow>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={rows}
      scroll={{ x: 360 }}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No patients are assigned to you yet." /> }}
      columns={[
        { title: "Patient", dataIndex: "name", render: (v: string, r) => <Link href={`/app/patients/${r.id}`}>{v}</Link> },
        { title: "Tracking ID", dataIndex: "trackingId" },
        { title: "Status", dataIndex: "status", render: (v: PatientStatus) => <Tag color={PATIENT_STATUS_TAG[v]}>{PATIENT_STATUS_LABEL[v]}</Tag> },
      ]}
    />
  );
}
