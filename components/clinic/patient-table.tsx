"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Col, DatePicker, Drawer, Flex, Form, Input, Row, Segmented, Select, Table, Tag } from "antd";
import type { TableProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PATIENT_STATUSES, SEXES, type PatientStatus } from "@/db/schema/enums";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import { PATIENT_STATUS_LABEL, PATIENT_STATUS_TAG, SEX_LABEL } from "@/lib/labels";
import { patientDetailsSchema } from "@/lib/validation/clinical";
import { admitPatientAction } from "@/server/actions/clinical";
import type { PatientListRow } from "@/server/services/patients";

type Query = { q?: string; status?: PatientStatus; page: number; pageSize: number };

function ageFrom(dob: string): string {
  const d = dayjs(dob);
  const years = dayjs().diff(d, "year");
  return years < 2 ? `${dayjs().diff(d, "month")} months` : `${years} years`;
}

export function PatientTable({
  rows,
  total,
  query,
  canAdmit,
  staff,
}: {
  rows: PatientListRow[];
  total: number;
  query: Query;
  canAdmit: boolean;
  staff: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, startTransition] = useTransition();
  const [admitting, setAdmitting] = useState(false);

  function go(next: Partial<Query>) {
    const merged = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status) params.set("status", merged.status);
    if (merged.page > 1) params.set("page", String(merged.page));
    if (merged.pageSize !== 20) params.set("pageSize", String(merged.pageSize));
    startTransition(() => router.push(`${pathname}${params.size ? `?${params}` : ""}`));
  }

  const columns: TableProps<PatientListRow>["columns"] = [
    { title: "Tracking ID", dataIndex: "trackingId", width: 150, render: (v: string, r) => <Link href={`/app/patients/${r.id}`}>{v}</Link> },
    { title: "Name", dataIndex: "name", render: (v: string, r) => <Link href={`/app/patients/${r.id}`}>{v}</Link> },
    { title: "Age", dataIndex: "dateOfBirth", width: 110, render: (v: string) => ageFrom(v) },
    { title: "Status", dataIndex: "status", width: 120, render: (v: PatientStatus) => <Tag color={PATIENT_STATUS_TAG[v]}>{PATIENT_STATUS_LABEL[v]}</Tag> },
    { title: "Guardian", key: "guardian", render: (_, r) => `${r.guardianName} · ${r.guardianPhone}` },
    { title: "Assigned staff", dataIndex: "assignedStaff", render: (v: string[]) => (v.length ? v.join(", ") : "None") },
  ];

  return (
    <>
      <Flex wrap gap={12} justify="space-between" style={{ marginBottom: 16 }}>
        <Flex wrap gap={12}>
          <Input.Search
            allowClear
            defaultValue={query.q}
            placeholder="Name or tracking ID"
            aria-label="Search patients by name or tracking ID"
            onSearch={(value) => go({ q: value.trim() || undefined, page: 1 })}
            style={{ width: 280 }}
          />
          <Segmented
            value={query.status ?? "all"}
            onChange={(value) => go({ status: value === "all" ? undefined : (value as PatientStatus), page: 1 })}
            options={[{ label: "All", value: "all" }, ...PATIENT_STATUSES.map((s) => ({ label: PATIENT_STATUS_LABEL[s], value: s }))]}
          />
        </Flex>
        {canAdmit ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdmitting(true)}>
            Admit patient
          </Button>
        ) : null}
      </Flex>
      <Table<PatientListRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} patients`,
          onChange: (page, pageSize) => go({ page, pageSize }),
        }}
        locale={{ emptyText: query.q ? "No patients match your search." : canAdmit ? "No patients yet. Use Admit patient to add one." : "No patients are assigned to you yet." }}
      />
      {admitting ? <AdmitDrawer staff={staff} onClose={() => setAdmitting(false)} /> : null}
    </>
  );
}

type AdmitValues = Record<string, unknown> & { dateOfBirth?: Dayjs; admittedOn?: Dayjs; assignStaffIds?: string[] };
const shape = patientDetailsSchema.shape;

function AdmitDrawer({ staff, onClose }: { staff: { id: string; fullName: string }[]; onClose: () => void }) {
  const [form] = Form.useForm<AdmitValues>();
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(values: AdmitValues) {
    setError(null);
    startTransition(async () => {
      const result = await admitPatientAction({
        ...values,
        dateOfBirth: values.dateOfBirth?.format("YYYY-MM-DD"),
        admittedOn: values.admittedOn?.format("YYYY-MM-DD"),
      });
      if (result.ok) {
        message.success({ content: `Admitted. Tracking ID ${result.data.trackingId}.`, duration: 8 });
        onClose();
        router.push(`/app/patients/${result.data.id}`);
        return;
      }
      if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Admit patient"
      size={640}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            Admit
          </Button>
        </Flex>
      }
    >
      <Form<AdmitValues> form={form} layout="vertical" requiredMark="optional" onFinish={submit} initialValues={{ sex: "not_stated", admittedOn: dayjs(), assignStaffIds: [] }}>
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="firstName" label="First name" required rules={[zodRule(shape.firstName)]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="lastName" label="Last name" required rules={[zodRule(shape.lastName)]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="preferredName" label="Preferred name" rules={[zodRule(shape.preferredName)]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="dateOfBirth" label="Date of birth" required rules={[{ required: true, message: "Please enter the date of birth." }]}>
              <DatePicker format="D MMM YYYY" disabledDate={(d) => d.isAfter(dayjs())} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="sex" label="Sex">
              <Select options={SEXES.map((s) => ({ value: s, label: SEX_LABEL[s] }))} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="diagnosisSummary" label="Diagnosis summary" rules={[zodRule(shape.diagnosisSummary)]}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="guardianName" label="Guardian name" required rules={[zodRule(shape.guardianName)]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="guardianRelationship" label="Relationship" required rules={[zodRule(shape.guardianRelationship)]}>
              <Input placeholder="For example: mother, father, grandparent" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="guardianPhone" label="Guardian phone" required rules={[zodRule(shape.guardianPhone)]}>
              <Input type="tel" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="guardianEmail" label="Guardian email" rules={[zodRule(shape.guardianEmail)]}>
              <Input type="email" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="address" label="Address" rules={[zodRule(shape.address)]}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="admittedOn" label="Admission date" required rules={[{ required: true, message: "Please choose the admission date." }]}>
              <DatePicker format="D MMM YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="assignStaffIds" label="Assign staff">
              <Select mode="multiple" placeholder="Doctors or specialists" options={staff.map((s) => ({ value: s.id, label: s.fullName }))} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="reason" label="Admission notes">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}

