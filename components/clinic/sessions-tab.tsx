"use client";

import { Alert, App, Button, Col, DatePicker, Drawer, Flex, Form, Input, Modal, Radio, Row, Select, Space, Table, Tag } from "antd";
import type { TableProps } from "antd";
import type { Dayjs } from "dayjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PATIENT_ATTENDANCE, type PatientAttendance, type RecordStatus, type SessionStatus } from "@/db/schema/enums";
import { applyFieldErrors } from "@/lib/form-rules";
import { PATIENT_ATTENDANCE_LABEL, RECORD_STATUS_LABEL, RECORD_STATUS_TAG, SESSION_STATUS_LABEL, SESSION_STATUS_TAG } from "@/lib/labels";
import type { ActionResult } from "@/lib/result";
import { formatDateTime } from "@/lib/time";
import { cancelSessionAction, markPatientAttendanceAction, rescheduleSessionAction } from "@/server/actions/clinical";
import type { SessionRow } from "@/server/services/sessions";
import type { WorkspacePerms } from "./patient-workspace";
import { DATE_TIME_FORMATS, isoToPicker, pickerToIso } from "./tz";

export function SessionsTab({
  sessions,
  page,
  staff,
  perms,
  timeZone,
}: {
  patientId: string;
  sessions: { rows: SessionRow[]; total: number };
  page: number;
  staff: { id: string; fullName: string }[];
  perms: WorkspacePerms;
  timeZone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [attendanceFor, setAttendanceFor] = useState<SessionRow | null>(null);
  const [moving, setMoving] = useState<SessionRow | null>(null);
  const [cancelling, setCancelling] = useState<SessionRow | null>(null);

  const canMark = (s: SessionRow) => perms.markAttendanceAll || s.staffProfileId === perms.staffProfileId;

  const columns: TableProps<SessionRow>["columns"] = [
    { title: "When", dataIndex: "scheduledStart", width: 210, render: (v: string) => formatDateTime(v, timeZone) },
    { title: "Therapy", dataIndex: "therapyName" },
    { title: "Therapist", dataIndex: "staffName" },
    { title: "Status", dataIndex: "status", render: (v: SessionStatus) => <Tag color={SESSION_STATUS_TAG[v]}>{SESSION_STATUS_LABEL[v]}</Tag> },
    { title: "Attendance", dataIndex: "attendance", render: (v: PatientAttendance | null, r) => (v ? `${PATIENT_ATTENDANCE_LABEL[v]}${r.attendanceReason ? `: ${r.attendanceReason}` : ""}` : "Not marked") },
    { title: "Record", dataIndex: "recordStatus", render: (v: RecordStatus) => <Tag color={RECORD_STATUS_TAG[v]}>{RECORD_STATUS_LABEL[v]}</Tag> },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space wrap size={4}>
          <Link href={`/app/sessions/${r.id}`}>Open record</Link>
          {canMark(r) && r.status !== "cancelled" ? (
            <Button size="small" type="link" onClick={() => setAttendanceFor(r)}>
              Attendance
            </Button>
          ) : null}
          {perms.manage && r.status === "scheduled" ? (
            <>
              <Button size="small" type="link" onClick={() => setMoving(r)}>
                Reschedule
              </Button>
              <Button size="small" type="link" danger onClick={() => setCancelling(r)}>
                Cancel
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Table<SessionRow>
        rowKey="id"
        columns={columns}
        dataSource={sessions.rows}
        scroll={{ x: 1000 }}
        locale={{ emptyText: "No sessions yet. Sessions are scheduled from the Treatment tab or the calendar." }}
        pagination={{
          current: page,
          pageSize: 20,
          total: sessions.total,
          showSizeChanger: false,
          onChange: (p) => router.push(`${pathname}?tab=sessions&page=${p}`),
        }}
      />
      {attendanceFor ? <AttendanceModal session={attendanceFor} onClose={() => setAttendanceFor(null)} /> : null}
      {moving ? <RescheduleDrawer session={moving} staff={staff} timeZone={timeZone} onClose={() => setMoving(null)} /> : null}
      {cancelling ? <CancelModal session={cancelling} onClose={() => setCancelling(null)} /> : null}
    </>
  );
}

function useSubmit<V>(form: ReturnType<typeof Form.useForm<V>>[0]) {
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(action: () => Promise<ActionResult<unknown>>, success: string, done: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        message.success({ content: success, duration: 6 });
        done();
      } else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }
  return { pending, error, submit };
}

export function AttendanceModal({ session, onClose }: { session: SessionRow; onClose: () => void }) {
  const [form] = Form.useForm<{ status: PatientAttendance; reason?: string }>();
  const { pending, error, submit } = useSubmit(form);
  const status = Form.useWatch("status", form);
  return (
    <Modal open title={`Attendance: ${session.patientName}`} okText="Save" okButtonProps={{ loading: pending }} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: session.attendance ?? "present", reason: session.attendanceReason ?? undefined }}
        onFinish={(v) => submit(() => markPatientAttendanceAction({ sessionId: session.id, ...v }), "Attendance saved.", onClose)}
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="status" label="Attendance" rules={[{ required: true }]}>
          <Radio.Group optionType="button" buttonStyle="solid" options={PATIENT_ATTENDANCE.map((s) => ({ value: s, label: PATIENT_ATTENDANCE_LABEL[s] }))} />
        </Form.Item>
        <Form.Item name="reason" label="Reason" rules={status && status !== "present" ? [{ required: true, message: "Please give a reason." }] : []}>
          <Input.TextArea rows={2} disabled={status === "present"} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function RescheduleDrawer({
  session,
  staff,
  timeZone,
  onClose,
}: {
  session: { id: string; staffProfileId: string; scheduledStart: string; scheduledEnd: string; patientName: string };
  staff: { id: string; fullName: string }[];
  timeZone: string;
  onClose: () => void;
}) {
  const [form] = Form.useForm<{ staffProfileId: string; start: Dayjs; durationMinutes: number }>();
  const { pending, error, submit } = useSubmit(form);
  const minutes = Math.round((Date.parse(session.scheduledEnd) - Date.parse(session.scheduledStart)) / 60_000);
  return (
    <Drawer
      open
      onClose={onClose}
      title={`Reschedule: ${session.patientName}`}
      size={480}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            Save
          </Button>
        </Flex>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ staffProfileId: session.staffProfileId, start: isoToPicker(session.scheduledStart, timeZone), durationMinutes: minutes }}
        onFinish={(v) => submit(() => rescheduleSessionAction({ id: session.id, staffProfileId: v.staffProfileId, start: pickerToIso(v.start, timeZone), durationMinutes: v.durationMinutes }), "Session moved.", onClose)}
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="staffProfileId" label="Therapist" rules={[{ required: true }]}>
          <Select showSearch={{ optionFilterProp: "label" }} options={staff.map((s) => ({ value: s.id, label: s.fullName }))} />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={14}>
            <Form.Item name="start" label="Date and time" rules={[{ required: true }]}>
              <DatePicker showTime={{ format: "HH:mm", minuteStep: 5 }} format={DATE_TIME_FORMATS} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name="durationMinutes" label="Duration" rules={[{ required: true }]}>
              <Select options={[30, 45, 60, 90].map((m) => ({ value: m, label: `${m} minutes` }))} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}

function CancelModal({ session, onClose }: { session: SessionRow; onClose: () => void }) {
  const [form] = Form.useForm<{ reason: string }>();
  const { pending, error, submit } = useSubmit(form);
  return (
    <Modal open title="Cancel this session?" okText="Cancel session" okButtonProps={{ danger: true, loading: pending }} cancelText="Keep it" onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(v) => submit(() => cancelSessionAction({ id: session.id, reason: v.reason }), "Session cancelled.", onClose)}>
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Please give a reason." }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
