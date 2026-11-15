"use client";

import { EditOutlined, StopOutlined, UndoOutlined, UserAddOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Flex, Form, Input, Modal, Popconfirm, Result, Row, Select, Space, Table, Tabs, Tag, Timeline, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SEXES } from "@/db/schema/enums";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import { ADMISSION_KIND_LABEL, PATIENT_STATUS_LABEL, PATIENT_STATUS_TAG, SEX_LABEL } from "@/lib/labels";
import type { ActionResult } from "@/lib/result";
import { formatDate, formatDateTime } from "@/lib/time";
import { cancelPatientSchema, patientDetailsSchema } from "@/lib/validation/clinical";
import { assignStaffAction, cancelPatientAction, readmitPatientAction, unassignStaffAction, updatePatientAction } from "@/server/actions/clinical";
import type { AuditRow } from "@/server/services/audit-trail";
import type { EnrollmentView } from "@/server/services/enrollments";
import type { MedicalFileRow } from "@/server/services/files";
import type { PatientDetail } from "@/server/services/patients";
import type { SessionRow } from "@/server/services/sessions";
import { FilesTab } from "./files-tab";
import { SessionsTab } from "./sessions-tab";
import { TreatmentTab } from "./treatment-tab";

export type WorkspaceTab = "overview" | "treatment" | "sessions" | "files" | "prescriptions" | "reports" | "finance" | "audit";

export type WorkspacePerms = {
  manage: boolean;
  editDetails: boolean;
  writeRecords: boolean;
  uploadFiles: boolean;
  deleteFiles: boolean;
  markAttendanceAll: boolean;
  staffProfileId: string | null;
};

type Props = {
  patient: PatientDetail;
  tab: WorkspaceTab;
  page: number;
  enrollments: EnrollmentView[];
  sessions: { rows: SessionRow[]; total: number };
  files: MedicalFileRow[];
  audit: AuditRow[];
  staff: { id: string; fullName: string }[];
  therapies: { slug: string; name: string }[];
  perms: WorkspacePerms;
  timeZone: string;
};

function age(dob: string) {
  const years = dayjs().diff(dayjs(dob), "year");
  return years < 2 ? `${dayjs().diff(dayjs(dob), "month")} months` : `${years} years`;
}

export function useActionRunner() {
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  function run<T>(action: () => Promise<ActionResult<T>>, success: string, after?: (data: T) => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        message.success({ content: success, duration: 6 });
        after?.(result.data);
      } else {
        message.error({ content: result.error.message, duration: 8 });
      }
    });
  }
  return { pending, run };
}

export function PatientWorkspace(props: Props) {
  const { patient, tab, perms, timeZone } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [readmitting, setReadmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const comingLater = (what: string) => (
    <Result status="info" title={`${what} arrive in Phase 3`} subTitle="This part of the patient record is not available yet." />
  );

  return (
    <>
      <Flex wrap justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            {patient.firstName} {patient.lastName}
            {patient.preferredName ? <Typography.Text type="secondary"> ({patient.preferredName})</Typography.Text> : null}
          </Typography.Title>
          <Space wrap>
            <Tag>{patient.trackingId}</Tag>
            <Tag color={PATIENT_STATUS_TAG[patient.status]}>{PATIENT_STATUS_LABEL[patient.status]}</Tag>
            <Typography.Text type="secondary">
              {age(patient.dateOfBirth)} · {SEX_LABEL[patient.sex]}
            </Typography.Text>
          </Space>
        </div>
        <Space wrap>
          {perms.editDetails ? (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Edit details
            </Button>
          ) : null}
          {perms.manage && patient.status === "active" ? (
            <Button danger icon={<StopOutlined />} onClick={() => setCancelling(true)}>
              Cancel
            </Button>
          ) : null}
          {perms.manage && patient.status !== "active" ? (
            <Button icon={<UndoOutlined />} onClick={() => setReadmitting(true)}>
              Re-admit
            </Button>
          ) : null}
        </Space>
      </Flex>

      <Tabs
        activeKey={tab}
        onChange={(key) => router.push(`${pathname}?tab=${key}`)}
        items={[
          { key: "overview", label: "Overview", children: tab === "overview" ? <Overview {...props} onAssign={() => setAssigning(true)} /> : null },
          { key: "treatment", label: "Treatment", children: tab === "treatment" ? <TreatmentTab patient={patient} enrollments={props.enrollments} staff={props.staff} therapies={props.therapies} perms={perms} timeZone={timeZone} /> : null },
          { key: "sessions", label: "Sessions", children: tab === "sessions" ? <SessionsTab patientId={patient.id} sessions={props.sessions} page={props.page} staff={props.staff} perms={perms} timeZone={timeZone} /> : null },
          { key: "files", label: "Files", children: tab === "files" ? <FilesTab patientId={patient.id} files={props.files} perms={perms} timeZone={timeZone} /> : null },
          { key: "prescriptions", label: "Prescriptions", children: tab === "prescriptions" ? comingLater("Prescriptions") : null },
          { key: "reports", label: "Reports", children: tab === "reports" ? comingLater("Report cards") : null },
          { key: "finance", label: "Finance", children: tab === "finance" ? comingLater("Invoices and payments") : null },
          { key: "audit", label: "Audit", children: tab === "audit" ? <AuditTab rows={props.audit} timeZone={timeZone} /> : null },
        ]}
      />

      {editing ? <EditDetailsDrawer patient={patient} onClose={() => setEditing(false)} /> : null}
      {cancelling ? <StatusModal kind="cancel" patientId={patient.id} onClose={() => setCancelling(false)} /> : null}
      {readmitting ? <StatusModal kind="readmit" patientId={patient.id} onClose={() => setReadmitting(false)} /> : null}
      {assigning ? <AssignModal patient={patient} staff={props.staff} onClose={() => setAssigning(false)} /> : null}
    </>
  );
}

function Overview({ patient, enrollments, perms, timeZone, onAssign }: Props & { onAssign: () => void }) {
  const { pending, run } = useActionRunner();
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={14}>
        <Card title="Details">
          <Descriptions
            column={{ xs: 1, md: 2 }}
            size="small"
            items={[
              { key: "dob", label: "Date of birth", children: formatDate(patient.dateOfBirth) },
              { key: "sex", label: "Sex", children: SEX_LABEL[patient.sex] },
              { key: "diag", label: "Diagnosis summary", children: patient.diagnosisSummary ?? "Not recorded", span: 2 },
              { key: "guardian", label: "Guardian", children: `${patient.guardianName} (${patient.guardianRelationship})` },
              { key: "phone", label: "Phone", children: patient.guardianPhone },
              { key: "email", label: "Email", children: patient.guardianEmail ?? "Not recorded" },
              { key: "address", label: "Address", children: patient.address ?? "Not recorded" },
              { key: "notes", label: "Notes", children: patient.notes ?? "None", span: 2 },
              { key: "therapies", label: "Therapies", children: enrollments.length ? enrollments.map((e) => e.therapyName).join(", ") : "Not enrolled yet", span: 2 },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} xl={10}>
        <Card
          title="Assigned staff"
          extra={
            perms.manage ? (
              <Button size="small" icon={<UserAddOutlined />} onClick={onAssign}>
                Assign
              </Button>
            ) : null
          }
        >
          {patient.assignments.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No staff assigned yet." />
          ) : (
            <Table
              size="small"
              rowKey="staffProfileId"
              pagination={false}
              dataSource={patient.assignments}
              columns={[
                { title: "Name", dataIndex: "fullName" },
                { title: "Since", dataIndex: "assignedAt", render: (v: string) => formatDate(v, timeZone) },
                ...(perms.manage
                  ? [
                      {
                        title: "",
                        key: "remove",
                        render: (_: unknown, r: PatientDetail["assignments"][number]) => (
                          <Popconfirm
                            title={`Unassign ${r.fullName}?`}
                            okText="Unassign"
                            onConfirm={() => run(() => unassignStaffAction({ patientId: patient.id, staffProfileId: r.staffProfileId }), "Staff member unassigned.")}
                          >
                            <Button size="small" type="link" danger loading={pending}>
                              Unassign
                            </Button>
                          </Popconfirm>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </Card>
        <Card title="Admission history" style={{ marginTop: 16 }}>
          <Timeline
            items={patient.admissions.map((a) => ({
              key: a.id,
              color: a.kind === "cancel" ? "red" : a.kind === "upgrade" ? "blue" : "green",
              content: (
                <>
                  <Typography.Text strong>{ADMISSION_KIND_LABEL[a.kind]}</Typography.Text> on {formatDate(a.effectiveOn)}
                  {a.reason ? <div>{a.reason}</div> : null}
                </>
              ),
            }))}
          />
        </Card>
      </Col>
    </Row>
  );
}

function AuditTab({ rows, timeZone }: { rows: AuditRow[]; timeZone: string }) {
  return (
    <Table<AuditRow>
      size="small"
      rowKey="id"
      dataSource={rows}
      pagination={{ pageSize: 20 }}
      scroll={{ x: 600 }}
      columns={[
        { title: "When", dataIndex: "createdAt", width: 220, render: (v: string) => formatDateTime(v, timeZone) },
        { title: "Action", dataIndex: "action", render: (v: string) => <Tag>{v}</Tag> },
        { title: "Record", dataIndex: "entityType" },
        { title: "By", dataIndex: "actor", render: (v: string | null) => v ?? "System" },
      ]}
    />
  );
}

type DetailsValues = Record<string, unknown> & { dateOfBirth?: Dayjs };
const shape = patientDetailsSchema.shape;

function EditDetailsDrawer({ patient, onClose }: { patient: PatientDetail; onClose: () => void }) {
  const [form] = Form.useForm<DetailsValues>();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(values: DetailsValues) {
    setError(null);
    startTransition(async () => {
      const result = await updatePatientAction({ ...values, id: patient.id, dateOfBirth: values.dateOfBirth?.format("YYYY-MM-DD") });
      if (result.ok) {
        message.success("Details saved.");
        onClose();
      } else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  const fields: [keyof typeof shape, string, boolean][] = [
    ["firstName", "First name", true],
    ["lastName", "Last name", true],
    ["preferredName", "Preferred name", false],
    ["guardianName", "Guardian name", true],
    ["guardianRelationship", "Relationship", true],
    ["guardianPhone", "Guardian phone", true],
    ["guardianEmail", "Guardian email", false],
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title="Edit details"
      size={600}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            Save
          </Button>
        </Flex>
      }
    >
      <Form<DetailsValues>
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={submit}
        initialValues={{ ...patient, dateOfBirth: dayjs(patient.dateOfBirth) }}
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        {fields.map(([name, label, required]) => (
          <Form.Item key={name} name={name} label={label} required={required} rules={[zodRule(shape[name])]}>
            <Input />
          </Form.Item>
        ))}
        <Form.Item name="dateOfBirth" label="Date of birth" required rules={[{ required: true, message: "Please enter the date of birth." }]}>
          <DatePicker format="D MMM YYYY" disabledDate={(d) => d.isAfter(dayjs())} />
        </Form.Item>
        <Form.Item name="sex" label="Sex">
          <Select options={SEXES.map((s) => ({ value: s, label: SEX_LABEL[s] }))} />
        </Form.Item>
        <Form.Item name="diagnosisSummary" label="Diagnosis summary" rules={[zodRule(shape.diagnosisSummary)]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="address" label="Address" rules={[zodRule(shape.address)]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="notes" label="Notes" rules={[zodRule(shape.notes)]}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function StatusModal({ kind, patientId, onClose }: { kind: "cancel" | "readmit"; patientId: string; onClose: () => void }) {
  const [form] = Form.useForm<{ effectiveOn: Dayjs; reason?: string }>();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(values: { effectiveOn: Dayjs; reason?: string }) {
    setError(null);
    startTransition(async () => {
      const payload = { id: patientId, effectiveOn: values.effectiveOn.format("YYYY-MM-DD"), reason: values.reason };
      const result = kind === "cancel" ? await cancelPatientAction(payload) : await readmitPatientAction(payload);
      if (result.ok) {
        message.success(kind === "cancel" ? "Patient cancelled." : "Patient re-admitted.");
        onClose();
      } else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Modal
      open
      title={kind === "cancel" ? "Cancel this patient?" : "Re-admit this patient?"}
      okText={kind === "cancel" ? "Cancel patient" : "Re-admit"}
      okButtonProps={{ danger: kind === "cancel", loading: pending }}
      cancelText="Close"
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ effectiveOn: dayjs() }}>
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="effectiveOn" label="Effective date" rules={[{ required: true, message: "Please choose a date." }]}>
          <DatePicker format="D MMM YYYY" />
        </Form.Item>
        <Form.Item name="reason" label="Reason" rules={kind === "cancel" ? [zodRule(cancelPatientSchema.shape.reason)] : []}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AssignModal({ patient, staff, onClose }: { patient: PatientDetail; staff: { id: string; fullName: string }[]; onClose: () => void }) {
  const [staffId, setStaffId] = useState<string>();
  const { pending, run } = useActionRunner();
  const assigned = new Set(patient.assignments.map((a) => a.staffProfileId));
  return (
    <Modal
      open
      title="Assign a staff member"
      okText="Assign"
      okButtonProps={{ disabled: !staffId, loading: pending }}
      onOk={() => staffId && run(() => assignStaffAction({ patientId: patient.id, staffProfileId: staffId }), "Staff member assigned.", onClose)}
      onCancel={onClose}
    >
      <Select
        style={{ width: "100%" }}
        placeholder="Choose a doctor or specialist"
        value={staffId}
        onChange={setStaffId}
        showSearch={{ optionFilterProp: "label" }}
        options={staff.filter((s) => !assigned.has(s.id)).map((s) => ({ value: s.id, label: s.fullName }))}
      />
    </Modal>
  );
}
