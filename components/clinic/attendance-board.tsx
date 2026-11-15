"use client";

import { LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, DatePicker, Descriptions, Flex, Form, Input, Modal, Radio, Row, Table, Tag, TimePicker, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STAFF_ATTENDANCE, type PatientAttendance, type SessionStatus, type StaffAttendance } from "@/db/schema/enums";
import { applyFieldErrors } from "@/lib/form-rules";
import { PATIENT_ATTENDANCE_LABEL, SESSION_STATUS_LABEL, SESSION_STATUS_TAG, STAFF_ATTENDANCE_LABEL, STAFF_ATTENDANCE_TAG, STAFF_TYPE_LABEL } from "@/lib/labels";
import { formatTime } from "@/lib/time";
import { markStaffAttendanceAction, selfCheckAction } from "@/server/actions/clinical";
import type { StaffDayRow, StaffMonthRow } from "@/server/services/attendance";
import type { SessionRow } from "@/server/services/sessions";
import { AttendanceMonth } from "./attendance-month";
import { useActionRunner } from "./patient-workspace";
import { AttendanceModal } from "./sessions-tab";

type Props = {
  isAdmin: boolean;
  day: string;
  today: string;
  month: string;
  staffRows: StaffDayRow[];
  sessions: SessionRow[];
  myMonth: StaffMonthRow[];
  myToday: StaffMonthRow | null;
  hasProfile: boolean;
  staffProfileId: string | null;
  timeZone: string;
};

export function AttendanceBoard(props: Props) {
  const { isAdmin, day, today, timeZone } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [marking, setMarking] = useState<StaffDayRow | null>(null);
  const [sessionFor, setSessionFor] = useState<SessionRow | null>(null);

  return (
    <Flex vertical gap={16}>
      <Flex wrap gap={12} align="center">
        <Typography.Text strong>Day</Typography.Text>
        <DatePicker
          value={dayjs(day)}
          format="D MMM YYYY"
          allowClear={false}
          aria-label="Day"
          onChange={(d) => d && router.push(`${pathname}?day=${d.format("YYYY-MM-DD")}`)}
        />
        {day !== today ? <Button onClick={() => router.push(pathname)}>Today</Button> : null}
      </Flex>

      {props.hasProfile && day === today ? <SelfCheck myToday={props.myToday} timeZone={timeZone} /> : null}

      {isAdmin ? (
        <Card title={`Staff attendance, ${dayjs(day).format("D MMM YYYY")}`}>
          <Table<StaffDayRow>
            size="small"
            rowKey="staffProfileId"
            dataSource={props.staffRows}
            pagination={false}
            scroll={{ x: 760 }}
            locale={{ emptyText: "No active staff." }}
            columns={[
              { title: "Name", dataIndex: "fullName", render: (v: string, r) => <Link href={`/app/staff/${r.staffProfileId}`}>{v}</Link> },
              { title: "Type", dataIndex: "staffType", render: (v: StaffDayRow["staffType"]) => STAFF_TYPE_LABEL[v] },
              { title: "Status", dataIndex: "status", render: (v: StaffAttendance | null) => (v ? <Tag color={STAFF_ATTENDANCE_TAG[v]}>{STAFF_ATTENDANCE_LABEL[v]}</Tag> : <Tag>Not marked</Tag>) },
              { title: "In", dataIndex: "checkInAt", render: (v: string | null) => (v ? formatTime(v, timeZone) : "") },
              { title: "Out", dataIndex: "checkOutAt", render: (v: string | null) => (v ? formatTime(v, timeZone) : "") },
              { title: "Note", dataIndex: "note", render: (v: string | null) => v ?? "" },
              {
                title: "",
                key: "mark",
                render: (_, r) => (
                  <Button size="small" onClick={() => setMarking(r)}>
                    Mark
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      <Card title={isAdmin ? "Patient attendance by session" : "My sessions"}>
        <Table<SessionRow>
          size="small"
          rowKey="id"
          dataSource={props.sessions}
          pagination={false}
          scroll={{ x: 760 }}
          locale={{ emptyText: "No sessions on this day." }}
          columns={[
            { title: "Time", dataIndex: "scheduledStart", width: 80, render: (v: string) => formatTime(v, timeZone) },
            { title: "Patient", dataIndex: "patientName", render: (v: string, r) => <Link href={`/app/patients/${r.patientId}?tab=sessions`}>{v}</Link> },
            { title: "Therapist", dataIndex: "staffName" },
            { title: "Session", dataIndex: "status", render: (v: SessionStatus) => <Tag color={SESSION_STATUS_TAG[v]}>{SESSION_STATUS_LABEL[v]}</Tag> },
            { title: "Attendance", dataIndex: "attendance", render: (v: PatientAttendance | null, r) => (v ? `${PATIENT_ATTENDANCE_LABEL[v]}${r.attendanceReason ? `: ${r.attendanceReason}` : ""}` : "Not marked") },
            {
              title: "",
              key: "mark",
              render: (_, r) =>
                r.status !== "cancelled" && (isAdmin || r.staffProfileId === props.staffProfileId) ? (
                  <Button size="small" onClick={() => setSessionFor(r)}>
                    Mark
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>

      {props.hasProfile ? (
        <Card title="My month">
          <AttendanceMonth rows={props.myMonth} month={props.month} timeZone={timeZone} />
        </Card>
      ) : null}

      {marking ? <StaffMarkModal row={marking} day={day} timeZone={timeZone} onClose={() => setMarking(null)} /> : null}
      {sessionFor ? <AttendanceModal session={sessionFor} onClose={() => setSessionFor(null)} /> : null}
    </Flex>
  );
}

function SelfCheck({ myToday, timeZone }: { myToday: StaffMonthRow | null; timeZone: string }) {
  const { pending, run } = useActionRunner();
  const checkedIn = Boolean(myToday?.checkInAt);
  const checkedOut = Boolean(myToday?.checkOutAt);
  return (
    <Card title="My attendance today">
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={14}>
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 3 }}
            items={[
              { key: "status", label: "Status", children: myToday ? <Tag color={STAFF_ATTENDANCE_TAG[myToday.status]}>{STAFF_ATTENDANCE_LABEL[myToday.status]}</Tag> : "Not checked in" },
              { key: "in", label: "In", children: myToday?.checkInAt ? formatTime(myToday.checkInAt, timeZone) : "" },
              { key: "out", label: "Out", children: myToday?.checkOutAt ? formatTime(myToday.checkOutAt, timeZone) : "" },
            ]}
          />
        </Col>
        <Col xs={24} md={10}>
          <Flex gap={8} wrap justify="flex-end">
            <Button type="primary" icon={<LoginOutlined />} disabled={checkedIn || myToday?.status === "leave"} loading={pending} onClick={() => run(() => selfCheckAction({ direction: "in" }), "Checked in.")}>
              Check in
            </Button>
            <Button icon={<LogoutOutlined />} disabled={!checkedIn || checkedOut} loading={pending} onClick={() => run(() => selfCheckAction({ direction: "out" }), "Checked out.")}>
              Check out
            </Button>
          </Flex>
        </Col>
      </Row>
    </Card>
  );
}

type MarkValues = { status: StaffAttendance; checkIn?: Dayjs; checkOut?: Dayjs; note?: string };

function StaffMarkModal({ row, day, timeZone, onClose }: { row: StaffDayRow; day: string; timeZone: string; onClose: () => void }) {
  const [form] = Form.useForm<MarkValues>();
  const status = Form.useWatch("status", form);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toPicker = (iso: string | null) => (iso ? dayjs(formatTime(iso, timeZone), "HH:mm") : undefined);

  function submit(v: MarkValues) {
    setError(null);
    startTransition(async () => {
      const result = await markStaffAttendanceAction({
        staffProfileId: row.staffProfileId,
        day,
        status: v.status,
        checkIn: v.status === "present" ? v.checkIn?.format("HH:mm") : undefined,
        checkOut: v.status === "present" ? v.checkOut?.format("HH:mm") : undefined,
        note: v.note,
      });
      if (result.ok) onClose();
      else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Modal open title={`Attendance: ${row.fullName}`} okText="Save" okButtonProps={{ loading: pending }} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
      <Form<MarkValues>
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={{ status: row.status ?? "present", checkIn: toPicker(row.checkInAt), checkOut: toPicker(row.checkOutAt), note: row.note ?? undefined }}
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="status" label="Status" rules={[{ required: true }]}>
          <Radio.Group optionType="button" buttonStyle="solid" options={STAFF_ATTENDANCE.map((s) => ({ value: s, label: STAFF_ATTENDANCE_LABEL[s] }))} />
        </Form.Item>
        {status === "present" ? (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="checkIn" label="Check in">
                <TimePicker format="HH:mm" minuteStep={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="checkOut" label="Check out">
                <TimePicker format="HH:mm" minuteStep={5} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        ) : null}
        <Form.Item name="note" label="Note">
          <Input maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
