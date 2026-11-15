"use client";

import { CalendarOutlined, PlusOutlined, RiseOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Flex, Form, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Space, Statistic, Steps, Table, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GOAL_STATUSES, type GoalStatus, type LifecycleStage } from "@/db/schema/enums";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import { ENROLLMENT_STATUS_LABEL, GOAL_STATUS_LABEL, GOAL_STATUS_TAG, RECORD_STATUS_LABEL, RECORD_STATUS_TAG, STAGE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/time";
import { goalSchema } from "@/lib/validation/clinical";
import {
  addGoalAction,
  createStageRecordAction,
  deleteGoalAction,
  enrollAction,
  scheduleSessionsAction,
  setGoalStatusAction,
  upgradeEnrollmentAction,
} from "@/server/actions/clinical";
import type { EnrollmentView, GoalRow } from "@/server/services/enrollments";
import type { PatientDetail } from "@/server/services/patients";
import type { WorkspacePerms } from "./patient-workspace";
import { useActionRunner } from "./patient-workspace";
import { DATE_TIME_FORMATS, pickerToIso } from "./tz";

const TIMELINE: (LifecycleStage | "sessions")[] = ["intake", "assessment", "plan", "sessions", "progress_review", "discharge"];
const TIMELINE_LABEL: Record<LifecycleStage | "sessions", string> = { ...STAGE_LABEL, sessions: "Sessions" };
const RECORD_STAGES: LifecycleStage[] = ["plan", "progress_review", "discharge"];

type Staff = { id: string; fullName: string };

export function TreatmentTab({
  patient,
  enrollments,
  staff,
  therapies,
  perms,
  timeZone,
}: {
  patient: PatientDetail;
  enrollments: EnrollmentView[];
  staff: Staff[];
  therapies: { slug: string; name: string }[];
  perms: WorkspacePerms;
  timeZone: string;
}) {
  const [enrolling, setEnrolling] = useState(false);
  return (
    <Flex vertical gap={16}>
      {perms.manage && patient.status === "active" ? (
        <Flex justify="flex-end">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEnrolling(true)}>
            Enroll in a therapy
          </Button>
        </Flex>
      ) : null}
      {enrollments.length === 0 ? (
        <Card>
          <Empty description={perms.manage ? "Not enrolled in any therapy yet. Use Enroll in a therapy to start a plan." : "Not enrolled in any therapy yet."} />
        </Card>
      ) : (
        enrollments.map((e) => <EnrollmentCard key={e.id} enrollment={e} staff={staff} perms={perms} timeZone={timeZone} />)
      )}
      {enrolling ? <EnrollDrawer patientId={patient.id} staff={staff} therapies={therapies} onClose={() => setEnrolling(false)} /> : null}
    </Flex>
  );
}

function EnrollmentCard({ enrollment: e, staff, perms, timeZone }: { enrollment: EnrollmentView; staff: Staff[]; perms: WorkspacePerms; timeZone: string }) {
  const router = useRouter();
  const { pending, run } = useActionRunner();
  const [upgrading, setUpgrading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  const remaining = Math.max(e.plannedSessions - e.completed, 0);
  const percent = Math.min(100, Math.round((e.completed / e.plannedSessions) * 100));
  const reached = TIMELINE.filter((s) => e.stages[s]);
  const current = Math.max(0, TIMELINE.findIndex((s) => !e.stages[s]) - 1);
  const open = e.status === "active" || e.status === "on_hold";

  return (
    <Card
      title={
        <Space wrap>
          {e.therapyName}
          <Tag color={open ? "success" : "default"}>{ENROLLMENT_STATUS_LABEL[e.status]}</Tag>
        </Space>
      }
      extra={
        perms.manage && open ? (
          <Space wrap>
            <Button icon={<CalendarOutlined />} onClick={() => setScheduling(true)}>
              Schedule sessions
            </Button>
            <Button icon={<RiseOutlined />} onClick={() => setUpgrading(true)}>
              Change plan
            </Button>
          </Space>
        ) : null
      }
    >
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Flex vertical align="center" gap={8}>
            <Progress type="circle" percent={percent} format={() => `${e.completed}/${e.plannedSessions}`} />
            <Typography.Text type="secondary">Completed of planned sessions</Typography.Text>
          </Flex>
        </Col>
        <Col xs={24} lg={16}>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="Completed" value={e.completed} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Remaining" value={remaining} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Scheduled" value={e.upcoming} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Missed" value={e.missed} />
            </Col>
          </Row>
          <Descriptions
            style={{ marginTop: 16 }}
            size="small"
            column={{ xs: 1, md: 2 }}
            items={[
              { key: "lead", label: "Lead therapist", children: e.leadStaffName ?? "Not set" },
              { key: "start", label: "Started", children: formatDate(e.startDate) },
              { key: "freq", label: "Frequency", children: `${e.sessionsPerWeek} per week, ${e.sessionMinutes} minutes` },
              { key: "signed", label: "Signed session records", children: e.signedRecords },
            ]}
          />
        </Col>
      </Row>

      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Lifecycle
      </Typography.Title>
      <Steps
        size="small"
        current={reached.length === 0 ? 0 : current}
        items={TIMELINE.map((s) => ({
          title: TIMELINE_LABEL[s],
          content: e.stages[s] ? formatDate(e.stages[s]!, timeZone) : undefined,
          status: e.stages[s] ? "finish" : "wait",
        }))}
        responsive
      />

      <Flex justify="space-between" align="center" style={{ marginTop: 24 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Goals
        </Typography.Title>
        {perms.writeRecords && open ? (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setAddingGoal(true)}>
            Add goal
          </Button>
        ) : null}
      </Flex>
      <Table<GoalRow>
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={e.goals}
        scroll={{ x: 640 }}
        locale={{ emptyText: "No goals yet." }}
        style={{ marginTop: 8 }}
        columns={[
          { title: "Goal", dataIndex: "title" },
          { title: "Baseline", dataIndex: "baseline", render: (v: string | null) => v ?? "" },
          { title: "Target", dataIndex: "target", render: (v: string | null) => v ?? "" },
          {
            title: "Status",
            dataIndex: "status",
            width: 180,
            render: (v: GoalStatus, g) =>
              perms.writeRecords ? (
                <Select
                  size="small"
                  value={v}
                  style={{ width: 160 }}
                  disabled={pending}
                  onChange={(status) => run(() => setGoalStatusAction({ id: g.id, status }), "Goal updated.")}
                  options={GOAL_STATUSES.map((s) => ({ value: s, label: GOAL_STATUS_LABEL[s] }))}
                />
              ) : (
                <Tag color={GOAL_STATUS_TAG[v]}>{GOAL_STATUS_LABEL[v]}</Tag>
              ),
          },
          ...(perms.manage
            ? [
                {
                  title: "",
                  key: "delete",
                  width: 90,
                  render: (_: unknown, g: GoalRow) => (
                    <Popconfirm title="Delete this goal?" description="It is kept in the audit trail." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => run(() => deleteGoalAction({ id: g.id }), "Goal deleted.")}>
                      <Button size="small" type="link" danger>
                        Delete
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]
            : []),
        ]}
      />

      <Flex wrap justify="space-between" align="center" gap={8} style={{ marginTop: 24 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Plan, review and discharge records
        </Typography.Title>
        {perms.writeRecords ? (
          <Space wrap>
            {RECORD_STAGES.map((stage) => (
              <Button
                key={stage}
                size="small"
                loading={pending}
                onClick={() => run(() => createStageRecordAction({ enrollmentId: e.id, stage }), "Draft created.", (data) => router.push(`/app/records/${data.id}`))}
              >
                New {STAGE_LABEL[stage].toLowerCase()}
              </Button>
            ))}
          </Space>
        ) : null}
      </Flex>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={e.records}
        style={{ marginTop: 8 }}
        locale={{ emptyText: "No records yet." }}
        columns={[
          { title: "Record", dataIndex: "stage", render: (v: LifecycleStage, r) => <Link href={`/app/records/${r.id}`}>{STAGE_LABEL[v]}</Link> },
          { title: "Status", dataIndex: "status", render: (v: keyof typeof RECORD_STATUS_LABEL) => <Tag color={RECORD_STATUS_TAG[v]}>{RECORD_STATUS_LABEL[v]}</Tag> },
          { title: "Template", dataIndex: "templateVersion", render: (v: number) => `v${v}` },
          { title: "Updated", dataIndex: "updatedAt", render: (v: string) => formatDate(v, timeZone) },
        ]}
      />

      {upgrading ? <UpgradeModal enrollment={e} onClose={() => setUpgrading(false)} /> : null}
      {scheduling ? <ScheduleDrawer enrollment={e} staff={staff} timeZone={timeZone} onClose={() => setScheduling(false)} /> : null}
      {addingGoal ? <GoalDrawer enrollmentId={e.id} onClose={() => setAddingGoal(false)} /> : null}
    </Card>
  );
}

function useSubmit<V>(form: ReturnType<typeof Form.useForm<V>>[0]) {
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(action: () => Promise<import("@/lib/result").ActionResult<unknown>>, success: string, done: () => void) {
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

const footer = (pending: boolean, onClose: () => void, onOk: () => void, label: string) => (
  <Flex justify="flex-end" gap={8}>
    <Button onClick={onClose}>Cancel</Button>
    <Button type="primary" loading={pending} onClick={onOk}>
      {label}
    </Button>
  </Flex>
);

type EnrollValues = { therapySlug: string; leadStaffId: string; plannedSessions: number; sessionsPerWeek: number; sessionMinutes: number; startDate: Dayjs };

function EnrollDrawer({ patientId, staff, therapies, onClose }: { patientId: string; staff: Staff[]; therapies: { slug: string; name: string }[]; onClose: () => void }) {
  const [form] = Form.useForm<EnrollValues>();
  const { pending, error, submit } = useSubmit(form);
  return (
    <Drawer open onClose={onClose} title="Enroll in a therapy" size={520} destroyOnHidden footer={footer(pending, onClose, () => form.submit(), "Enroll")}>
      <Form<EnrollValues>
        form={form}
        layout="vertical"
        initialValues={{ plannedSessions: 24, sessionsPerWeek: 2, sessionMinutes: 45, startDate: dayjs() }}
        onFinish={(v) => submit(() => enrollAction({ ...v, patientId, startDate: v.startDate.format("YYYY-MM-DD") }), "Enrolled.", onClose)}
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="therapySlug" label="Therapy" rules={[{ required: true, message: "Please choose a therapy." }]}>
          <Select options={therapies.map((t) => ({ value: t.slug, label: t.name }))} />
        </Form.Item>
        <Form.Item name="leadStaffId" label="Lead therapist" rules={[{ required: true, message: "Please choose a therapist." }]} extra="They are assigned to the patient if they are not already.">
          <Select showSearch={{ optionFilterProp: "label" }} options={staff.map((s) => ({ value: s.id, label: s.fullName }))} />
        </Form.Item>
        <PlanFields />
        <Form.Item name="startDate" label="Start date" rules={[{ required: true }]}>
          <DatePicker format="D MMM YYYY" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function PlanFields() {
  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <Form.Item name="plannedSessions" label="Planned sessions" rules={[{ required: true }]}>
          <InputNumber min={1} max={500} precision={0} style={{ width: "100%" }} />
        </Form.Item>
      </Col>
      <Col xs={12} md={8}>
        <Form.Item name="sessionsPerWeek" label="Per week" rules={[{ required: true }]}>
          <InputNumber min={1} max={14} precision={0} style={{ width: "100%" }} />
        </Form.Item>
      </Col>
      <Col xs={12} md={8}>
        <Form.Item name="sessionMinutes" label="Minutes" rules={[{ required: true }]}>
          <Select options={[30, 45, 60, 90].map((m) => ({ value: m, label: `${m} minutes` }))} />
        </Form.Item>
      </Col>
    </Row>
  );
}

type UpgradeValues = { plannedSessions: number; sessionsPerWeek: number; sessionMinutes: number; effectiveOn: Dayjs; reason: string };

function UpgradeModal({ enrollment, onClose }: { enrollment: EnrollmentView; onClose: () => void }) {
  const [form] = Form.useForm<UpgradeValues>();
  const { pending, error, submit } = useSubmit(form);
  return (
    <Modal open title={`Change plan: ${enrollment.therapyName}`} okText="Save change" okButtonProps={{ loading: pending }} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
      <Typography.Paragraph type="secondary">The change is recorded in the admission history as an upgrade.</Typography.Paragraph>
      <Form<UpgradeValues>
        form={form}
        layout="vertical"
        initialValues={{ plannedSessions: enrollment.plannedSessions, sessionsPerWeek: enrollment.sessionsPerWeek, sessionMinutes: enrollment.sessionMinutes, effectiveOn: dayjs() }}
        onFinish={(v) => submit(() => upgradeEnrollmentAction({ ...v, enrollmentId: enrollment.id, effectiveOn: v.effectiveOn.format("YYYY-MM-DD") }), "Plan changed.", onClose)}
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <PlanFields />
        <Form.Item name="effectiveOn" label="Effective date" rules={[{ required: true }]}>
          <DatePicker format="D MMM YYYY" />
        </Form.Item>
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Please give a reason." }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

type ScheduleValues = { staffProfileId: string; start: Dayjs; durationMinutes: number; repeatWeeks: number };

function ScheduleDrawer({ enrollment, staff, timeZone, onClose }: { enrollment: EnrollmentView; staff: Staff[]; timeZone: string; onClose: () => void }) {
  const [form] = Form.useForm<ScheduleValues>();
  const { pending, error, submit } = useSubmit(form);
  return (
    <Drawer open onClose={onClose} title={`Schedule sessions: ${enrollment.therapyName}`} size={520} destroyOnHidden footer={footer(pending, onClose, () => form.submit(), "Schedule")}>
      <Form<ScheduleValues>
        form={form}
        layout="vertical"
        initialValues={{ staffProfileId: enrollment.leadStaffId ?? undefined, durationMinutes: enrollment.sessionMinutes, repeatWeeks: 1 }}
        onFinish={(v) =>
          submit(
            () => scheduleSessionsAction({ enrollmentId: enrollment.id, staffProfileId: v.staffProfileId, start: pickerToIso(v.start, timeZone), durationMinutes: v.durationMinutes, repeatWeeks: v.repeatWeeks }),
            v.repeatWeeks > 1 ? `${v.repeatWeeks} weekly sessions scheduled.` : "Session scheduled.",
            onClose,
          )
        }
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Typography.Paragraph type="secondary">Times are in the clinic time zone ({timeZone}). Double-booking of the therapist or patient is refused.</Typography.Paragraph>
        <Form.Item name="staffProfileId" label="Therapist" rules={[{ required: true, message: "Please choose a therapist." }]}>
          <Select showSearch={{ optionFilterProp: "label" }} options={staff.map((s) => ({ value: s.id, label: s.fullName }))} />
        </Form.Item>
        <Form.Item name="start" label="First session" rules={[{ required: true, message: "Please choose a date and time." }]}>
          <DatePicker showTime={{ format: "HH:mm", minuteStep: 5 }} format={DATE_TIME_FORMATS} style={{ width: "100%" }} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="durationMinutes" label="Duration" rules={[{ required: true }]}>
              <Select options={[30, 45, 60, 90].map((m) => ({ value: m, label: `${m} minutes` }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="repeatWeeks" label="Repeat weekly for" rules={[{ required: true }]}>
              <InputNumber min={1} max={26} precision={0} suffix="weeks" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}

type GoalValues = { title: string; baseline?: string; target?: string; measure?: string; targetDate?: Dayjs };
const goalShape = goalSchema.shape;

function GoalDrawer({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const [form] = Form.useForm<GoalValues>();
  const { pending, error, submit } = useSubmit(form);
  return (
    <Drawer open onClose={onClose} title="Add goal" size={520} destroyOnHidden footer={footer(pending, onClose, () => form.submit(), "Add goal")}>
      <Form<GoalValues> form={form} layout="vertical" requiredMark="optional" onFinish={(v) => submit(() => addGoalAction({ ...v, enrollmentId, targetDate: v.targetDate?.format("YYYY-MM-DD") }), "Goal added.", onClose)}>
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Form.Item name="title" label="Goal" required rules={[zodRule(goalShape.title)]} extra="Specific and measurable, for example: asks for help using two-word phrases.">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="baseline" label="Baseline" rules={[zodRule(goalShape.baseline)]}>
          <Input />
        </Form.Item>
        <Form.Item name="target" label="Target" rules={[zodRule(goalShape.target)]}>
          <Input />
        </Form.Item>
        <Form.Item name="measure" label="How it is measured" rules={[zodRule(goalShape.measure)]}>
          <Input />
        </Form.Item>
        <Form.Item name="targetDate" label="Target date">
          <DatePicker format="D MMM YYYY" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
