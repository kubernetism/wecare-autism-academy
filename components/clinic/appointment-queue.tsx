"use client";

import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AppointmentType } from "@/db/schema/enums";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_TAG,
  APPOINTMENT_TYPE_LABEL,
  PREFERRED_TIME_LABEL,
} from "@/lib/labels";
import type { ActionResult } from "@/lib/result";
import { formatDate, formatDateTime, wallClockInZone, zonedTimeToUtc } from "@/lib/time";
import { rejectAppointmentSchema } from "@/lib/validation/clinic";
import {
  approveAppointment,
  cancelAppointment,
  completeAppointment,
  rejectAppointment,
  scheduleAppointment,
} from "@/server/actions/clinic";
import type { AppointmentRow, QueueTab } from "@/server/services/appointments";

type StaffOption = { id: string; fullName: string; title: string | null };

const TAB_LABEL: Record<QueueTab, string> = {
  pending: "Pending",
  approved: "Approved",
  scheduled: "Scheduled",
  closed: "Closed",
};

const DURATION_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1 hour 30 minutes" },
  { value: 120, label: "2 hours" },
];

type Props = {
  rows: AppointmentRow[];
  counts: Record<QueueTab, number>;
  staff: StaffOption[];
  tab: QueueTab;
  type: AppointmentType | null;
  canManage: boolean;
  timeZone: string;
};

export function AppointmentQueue({ rows, counts, staff, tab, type, canManage, timeZone }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { message } = App.useApp();
  const [navigating, startNavigation] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [details, setDetails] = useState<AppointmentRow | null>(null);
  const [scheduling, setScheduling] = useState<AppointmentRow | null>(null);
  const [rejecting, setRejecting] = useState<AppointmentRow | null>(null);

  function go(next: { tab?: QueueTab; type?: AppointmentType | null }) {
    const params = new URLSearchParams();
    params.set("tab", next.tab ?? tab);
    const t = next.type === undefined ? type : next.type;
    if (t) params.set("type", t);
    startNavigation(() => router.push(`${pathname}?${params.toString()}`));
  }

  async function runSimple(
    row: AppointmentRow,
    action: (input: unknown) => Promise<ActionResult>,
    success: string,
  ) {
    setBusyId(row.id);
    const result = await action({ id: row.id });
    setBusyId(null);
    if (result.ok) {
      message.success({ content: success, duration: 6 });
      setDetails(null);
    } else {
      message.error({ content: result.error.message, duration: 8 });
    }
  }

  function actionsFor(row: AppointmentRow) {
    if (!canManage) return null;
    const busy = busyId === row.id;
    const name = row.childName ?? row.contactName;
    const buttons = [];
    if (row.status === "pending") {
      buttons.push(
        <Button key="approve" loading={busy} onClick={() => runSimple(row, approveAppointment, `Approved the request from ${row.contactName}.`)}>
          Approve
        </Button>,
      );
    }
    if (row.status === "pending" || row.status === "approved" || row.status === "scheduled") {
      buttons.push(
        <Button key="schedule" type={row.status === "scheduled" ? "default" : "primary"} onClick={() => setScheduling(row)}>
          {row.status === "scheduled" ? "Reschedule" : "Schedule"}
        </Button>,
      );
    }
    if (row.status === "scheduled") {
      buttons.push(
        <Popconfirm
          key="complete"
          title="Mark as completed?"
          description={`Confirm that the visit for ${name} took place.`}
          okText="Mark completed"
          cancelText="Keep scheduled"
          onConfirm={() => runSimple(row, completeAppointment, "Marked as completed.")}
        >
          <Button loading={busy}>Completed</Button>
        </Popconfirm>,
      );
    }
    if (row.status === "approved" || row.status === "scheduled") {
      buttons.push(
        <Popconfirm
          key="cancel"
          title="Cancel this appointment?"
          description="Let the family know by phone or email."
          okText="Cancel appointment"
          okButtonProps={{ danger: true }}
          cancelText="Keep it"
          onConfirm={() => runSimple(row, cancelAppointment, "Appointment cancelled.")}
        >
          <Button danger>Cancel</Button>
        </Popconfirm>,
      );
    }
    if (row.status === "pending" || row.status === "approved") {
      buttons.push(
        <Button key="reject" danger onClick={() => setRejecting(row)}>
          Decline
        </Button>,
      );
    }
    return buttons;
  }

  const columns: TableProps<AppointmentRow>["columns"] = [
    {
      title: "Requested",
      dataIndex: "createdAt",
      width: 130,
      render: (value: string) => <span>{formatDate(value, timeZone)}</span>,
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 140,
      render: (value: AppointmentType) => <Tag>{APPOINTMENT_TYPE_LABEL[value]}</Tag>,
    },
    {
      title: "Family",
      key: "family",
      render: (_, row) => (
        <Flex vertical>
          <Typography.Text strong>{row.contactName}</Typography.Text>
          <Typography.Text type="secondary">
            {row.childName ? `Child: ${row.childName}${row.childAgeYears !== null ? `, ${row.childAgeYears} y` : ""}` : "Child details not given"}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Therapy",
      dataIndex: "therapyName",
      render: (value: string | null) => value ?? <Typography.Text type="secondary">Not sure yet</Typography.Text>,
    },
    tab === "scheduled" || tab === "closed"
      ? {
          title: tab === "scheduled" ? "When / therapist" : "Outcome",
          key: "when",
          render: (_, row) =>
            tab === "closed" ? (
              <Tag color={APPOINTMENT_STATUS_TAG[row.status]}>{APPOINTMENT_STATUS_LABEL[row.status]}</Tag>
            ) : (
              <Flex vertical>
                <span>{row.scheduledStart ? formatDateTime(row.scheduledStart, timeZone) : "No time set"}</span>
                <Typography.Text type="secondary">{row.assignedStaffName ?? "No therapist assigned"}</Typography.Text>
              </Flex>
            ),
        }
      : {
          title: "Preferred",
          key: "preferred",
          render: (_, row) => (
            <span>
              {row.preferredDate ? formatDate(row.preferredDate) : "Any day"}, {PREFERRED_TIME_LABEL[row.preferredTime].toLowerCase()}
            </span>
          ),
        },
    {
      title: "Actions",
      key: "actions",
      render: (_, row) => (
        <Space wrap size={8}>
          <Button type="link" onClick={() => setDetails(row)} style={{ paddingInline: 4 }}>
            Details
          </Button>
          {actionsFor(row)}
        </Space>
      ),
    },
  ];

  const empty = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        tab === "pending"
          ? "No requests are waiting. New requests from the website appear here."
          : `No ${TAB_LABEL[tab].toLowerCase()} requests${type ? ` of this type` : ""}.`
      }
    />
  );

  return (
    <Card>
      <Tabs
        activeKey={tab}
        onChange={(key) => go({ tab: key as QueueTab })}
        items={(Object.keys(TAB_LABEL) as QueueTab[]).map((key) => ({
          key,
          label: `${TAB_LABEL[key]} (${counts[key]})`,
        }))}
      />
      <Segmented
        style={{ marginBottom: 16, maxWidth: "100%", overflowX: "auto" }}
        value={type ?? "all"}
        onChange={(value) => go({ type: value === "all" ? null : (value as AppointmentType) })}
        options={[
          { label: "All types", value: "all" },
          { label: "Appointments", value: "appointment" },
          { label: "Demo sessions", value: "demo_session" },
          { label: "Introductions", value: "introduction" },
        ]}
      />

      <Table<AppointmentRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={navigating}
          pagination={false}
          locale={{ emptyText: empty }}
          scroll={{ x: 900 }}
        />

      <DetailsDrawer row={details} timeZone={timeZone} onClose={() => setDetails(null)} actions={details ? actionsFor(details) : null} />

      {scheduling && (
        <ScheduleDrawer
          row={scheduling}
          staff={staff}
          timeZone={timeZone}
          onClose={() => setScheduling(null)}
          onDone={(text) => {
            setScheduling(null);
            setDetails(null);
            message.success({ content: text, duration: 6 });
          }}
        />
      )}

      {rejecting && (
        <RejectModal
          row={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            setDetails(null);
            message.success({ content: "Request declined.", duration: 6 });
          }}
        />
      )}
    </Card>
  );
}

function DetailsDrawer({
  row,
  timeZone,
  onClose,
  actions,
}: {
  row: AppointmentRow | null;
  timeZone: string;
  onClose: () => void;
  actions: React.ReactNode;
}) {
  return (
    <Drawer
      open={row !== null}
      onClose={onClose}
      title={row ? `${APPOINTMENT_TYPE_LABEL[row.type]} request` : ""}
      size={560}
      footer={actions ? <Flex wrap gap={8}>{actions}</Flex> : null}
    >
      {row && (
        <Descriptions
          column={1}
          bordered
          size="small"
          items={[
            { key: "status", label: "Status", children: <Tag color={APPOINTMENT_STATUS_TAG[row.status]}>{APPOINTMENT_STATUS_LABEL[row.status]}</Tag> },
            { key: "name", label: "Parent or guardian", children: row.contactName },
            { key: "phone", label: "Phone", children: <a href={`tel:${row.contactPhone.replace(/[^+0-9]/g, "")}`}>{row.contactPhone}</a> },
            { key: "email", label: "Email", children: <a href={`mailto:${row.contactEmail}`}>{row.contactEmail}</a> },
            { key: "child", label: "Child", children: row.childName ? `${row.childName}${row.childAgeYears !== null ? `, ${row.childAgeYears} years` : ""}` : "Not given" },
            { key: "therapy", label: "Therapy", children: row.therapyName ?? "Not sure yet" },
            {
              key: "preferred",
              label: "Preferred time",
              children: `${row.preferredDate ? formatDate(row.preferredDate) : "Any day"}, ${PREFERRED_TIME_LABEL[row.preferredTime].toLowerCase()}`,
            },
            ...(row.scheduledStart
              ? [{ key: "scheduled", label: "Scheduled", children: `${formatDateTime(row.scheduledStart, timeZone)}${row.scheduledEnd ? ` to ${formatDateTime(row.scheduledEnd, timeZone).split(", ").pop()}` : ""}` }]
              : []),
            ...(row.assignedStaffName ? [{ key: "staff", label: "Therapist", children: row.assignedStaffName }] : []),
            { key: "message", label: "Message", children: row.message ? <span style={{ whiteSpace: "pre-wrap" }}>{row.message}</span> : "No message" },
            ...(row.decisionNote ? [{ key: "note", label: "Internal note", children: <span style={{ whiteSpace: "pre-wrap" }}>{row.decisionNote}</span> }] : []),
            { key: "created", label: "Requested", children: formatDateTime(row.createdAt, timeZone) },
          ]}
        />
      )}
    </Drawer>
  );
}

type ScheduleValues = { start: Dayjs | null; durationMinutes: number; assignedStaffId?: string; note?: string };

/** The picker shows clinic wall-clock time; convert to/from instants in the clinic zone. */
function toPickerValue(iso: string | null, timeZone: string): Dayjs | null {
  if (!iso) return null;
  const w = wallClockInZone(new Date(iso), timeZone);
  return dayjs(new Date(w.year, w.month - 1, w.day, w.hour, w.minute));
}

function ScheduleDrawer({
  row,
  staff,
  timeZone,
  onClose,
  onDone,
}: {
  row: AppointmentRow;
  staff: StaffOption[];
  timeZone: string;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [form] = Form.useForm<ScheduleValues>();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialDuration =
    row.scheduledStart && row.scheduledEnd
      ? Math.round((Date.parse(row.scheduledEnd) - Date.parse(row.scheduledStart)) / 60_000)
      : 60;

  function submit(values: ScheduleValues) {
    if (!values.start) return;
    setError(null);
    const start = zonedTimeToUtc(
      { year: values.start.year(), month: values.start.month() + 1, day: values.start.date(), hour: values.start.hour(), minute: values.start.minute() },
      timeZone,
    );
    startTransition(async () => {
      const result = await scheduleAppointment({
        id: row.id,
        start: start.toISOString(),
        durationMinutes: values.durationMinutes,
        assignedStaffId: values.assignedStaffId ?? null,
        note: values.note,
      });
      if (result.ok) {
        onDone(`Scheduled for ${formatDateTime(start.toISOString(), timeZone)}.`);
      } else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") {
        setError(result.error.message);
      }
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${row.status === "scheduled" ? "Reschedule" : "Schedule"}: ${row.childName ?? row.contactName}`}
      size={520}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            Save schedule
          </Button>
        </Flex>
      }
    >
      <Form<ScheduleValues>
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={submit}
        initialValues={{
          start: toPickerValue(row.scheduledStart, timeZone),
          durationMinutes: DURATION_OPTIONS.some((o) => o.value === initialDuration) ? initialDuration : 60,
          assignedStaffId: row.assignedStaffId ?? undefined,
        }}
      >
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Typography.Paragraph type="secondary">
          Preferred: {row.preferredDate ? formatDate(row.preferredDate) : "any day"}, {PREFERRED_TIME_LABEL[row.preferredTime].toLowerCase()}. Times are in the clinic time zone ({timeZone}).
        </Typography.Paragraph>
        <Form.Item name="start" label="Date and time" rules={[{ required: true, message: "Please choose a date and time." }]}>
          <DatePicker
            showTime={{ format: "HH:mm", minuteStep: 5 }}
            // First format is displayed; all are accepted when typing. No weekday
            // token: dayjs cannot parse it, so typed dates would be discarded.
            format={["D MMM YYYY, HH:mm", "D/M/YYYY HH:mm", "YYYY-MM-DD HH:mm"]}
            style={{ width: "100%" }}
            disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
          />
        </Form.Item>
        <Form.Item name="durationMinutes" label="Duration" rules={[{ required: true }]}>
          <Select options={DURATION_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="assignedStaffId"
          label="Therapist"
          extra={staff.length === 0 ? "No staff accounts yet. Add them under Settings, Users and roles." : undefined}
        >
          <Select
            allowClear
            placeholder="Not assigned yet"
            options={staff.map((s) => ({ value: s.id, label: s.title ? `${s.fullName} (${s.title})` : s.fullName }))}
            showSearch={{ optionFilterProp: "label" }}
          />
        </Form.Item>
        <Form.Item name="note" label="Internal note" rules={[{ max: 500 }]}>
          <Input.TextArea rows={3} placeholder="For example: first visit, bring previous reports" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function RejectModal({ row, onClose, onDone }: { row: AppointmentRow; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm<{ note: string }>();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(values: { note: string }) {
    setError(null);
    startTransition(async () => {
      const result = await rejectAppointment({ id: row.id, note: values.note });
      if (result.ok) onDone();
      else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Modal
      open
      title={`Decline the request from ${row.contactName}?`}
      okText="Decline request"
      okButtonProps={{ danger: true, loading: pending }}
      cancelText="Keep request"
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Form.Item
          name="note"
          label="Reason (kept internally)"
          rules={[zodRule(rejectAppointmentSchema.shape.note)]}
          extra="Contact the family directly to let them know."
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
