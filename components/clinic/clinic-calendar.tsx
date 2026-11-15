"use client";

import { LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { Alert, App, Button, Col, DatePicker, Descriptions, Drawer, Empty, Flex, Form, InputNumber, Row, Segmented, Select, Space, Tag, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyFieldErrors } from "@/lib/form-rules";
import { SESSION_STATUS_LABEL, SESSION_STATUS_TAG } from "@/lib/labels";
import { formatTime, wallClockInZone } from "@/lib/time";
import { scheduleSessionsAction } from "@/server/actions/clinical";
import type { CalendarEvent } from "@/server/services/calendar";
import { RescheduleDrawer } from "./sessions-tab";
import { DATE_TIME_FORMATS, isoToPicker, pickerToIso } from "./tz";

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_PX = 56;
const GRID_PX = (END_HOUR - START_HOUR) * HOUR_PX;

type Therapist = { id: string; name: string };
type EnrollmentOption = { id: string; patientName: string; trackingId: string; therapyName: string; leadStaffId: string | null; sessionMinutes: number };
type Column = { key: string; label: string; sub?: string; day: string; staffId?: string };

type Props = {
  view: "day" | "week";
  date: string;
  today: string;
  days: string[];
  therapists: Therapist[];
  events: CalendarEvent[];
  staffFilter?: string;
  canSchedule: boolean;
  enrollments: EnrollmentOption[];
  timeZone: string;
};

/** Minutes since midnight (clinic time) and the clinic-local date of an instant. */
function local(iso: string, tz: string) {
  const w = wallClockInZone(new Date(iso), tz);
  return { ymd: `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`, minutes: w.hour * 60 + w.minute };
}

/** Side-by-side lanes for overlapping events in one column. */
function layout(events: CalendarEvent[], tz: string) {
  const items = events
    .map((e) => {
      const s = local(e.start, tz).minutes;
      return { e, s, en: Math.max(s + 15, s + Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60_000)) };
    })
    .sort((a, b) => a.s - b.s);
  const placed: { e: CalendarEvent; s: number; en: number; lane: number; lanes: number }[] = [];
  let group: typeof placed = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) g.lanes = lanes;
    group = [];
  };
  for (const it of items) {
    if (it.s >= groupEnd) {
      flush();
      groupEnd = -1;
    }
    const used = new Set(group.filter((g) => g.en > it.s).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const p = { ...it, lane, lanes: 1 };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, it.en);
  }
  flush();
  return placed;
}

export function ClinicCalendar(props: Props) {
  const { view, date, today, days, therapists, events, staffFilter, canSchedule, timeZone } = props;
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [moving, setMoving] = useState<CalendarEvent | null>(null);
  const [slot, setSlot] = useState<{ staffId?: string; start?: Dayjs } | null>(null);
  const nameOf = new Map(therapists.map((t) => [t.id, t.name]));

  const go = (next: { view?: string; date?: string; staff?: string | null }) => {
    const params = new URLSearchParams();
    params.set("view", next.view ?? view);
    params.set("date", next.date ?? date);
    const s = next.staff === undefined ? staffFilter : next.staff;
    if (s) params.set("staff", s);
    router.push(`${pathname}?${params}`);
  };
  const step = view === "week" ? 7 : 1;
  const shift = (n: number) => go({ date: dayjs(date).add(n * step, "day").format("YYYY-MM-DD") });

  const columns: Column[] =
    view === "day"
      ? therapists.map((t) => ({ key: t.id, label: t.name, day: days[0] ?? date, staffId: t.id }))
      : days.map((d) => ({ key: d, label: dayjs(d).format("ddd D MMM"), day: d, staffId: staffFilter }));

  const eventsFor = (c: Column) =>
    events.filter((e) => local(e.start, timeZone).ymd === c.day && (c.staffId ? e.staffProfileId === c.staffId : true));

  const title = view === "day" ? dayjs(date).format("dddd D MMMM YYYY") : `${dayjs(days[0]).format("D MMM")} to ${dayjs(days[days.length - 1]).format("D MMM YYYY")}`;

  return (
    <>
      <Flex wrap gap={12} justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<LeftOutlined />} aria-label={view === "week" ? "Previous week" : "Previous day"} onClick={() => shift(-1)} />
          <Button onClick={() => go({ date: today })}>Today</Button>
          <Button icon={<RightOutlined />} aria-label={view === "week" ? "Next week" : "Next day"} onClick={() => shift(1)} />
          <DatePicker value={dayjs(date)} allowClear={false} format="D MMM YYYY" aria-label="Go to date" onChange={(d) => d && go({ date: d.format("YYYY-MM-DD") })} />
          <Typography.Text strong>{title}</Typography.Text>
        </Space>
        <Space wrap>
          <Segmented value={view} onChange={(v) => go({ view: v as string })} options={[{ label: "Day", value: "day" }, { label: "Week", value: "week" }]} />
          {view === "week" && therapists.length > 1 ? (
            <Select
              allowClear
              placeholder="All therapists"
              value={staffFilter}
              style={{ width: 200 }}
              aria-label="Therapist"
              onChange={(v) => go({ staff: v ?? null })}
              options={therapists.map((t) => ({ value: t.id, label: t.name }))}
            />
          ) : null}
          {canSchedule ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setSlot({})}>
              Schedule session
            </Button>
          ) : null}
        </Space>
      </Flex>

      {columns.length === 0 ? (
        <Empty description={canSchedule ? "No active therapists yet. Add doctors or specialists under Staff." : "Your account has no staff profile, so there is no calendar to show."} />
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, background: token.colorBgContainer }}>
          <div style={{ display: "grid", gridTemplateColumns: `56px repeat(${columns.length}, minmax(150px, 1fr))`, minWidth: 56 + columns.length * 150 }}>
            <div style={{ position: "sticky", left: 0, zIndex: 2, background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }} />
            {columns.map((c) => (
              <div
                key={c.key}
                style={{
                  padding: "8px 8px",
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  borderLeft: `1px solid ${token.colorBorderSecondary}`,
                  fontWeight: 600,
                  background: c.day === today && view === "week" ? token.colorPrimaryBg : undefined,
                }}
              >
                {c.label}
              </div>
            ))}

            <div style={{ position: "sticky", left: 0, zIndex: 2, background: token.colorBgContainer, height: GRID_PX }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div key={i} style={{ height: HOUR_PX, paddingRight: 6, textAlign: "right", fontSize: token.fontSizeSM, color: token.colorTextSecondary, transform: "translateY(-0.6em)" }}>
                  {i === 0 ? "" : `${String(START_HOUR + i).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {columns.map((c) => (
              <div
                key={c.key}
                style={{
                  position: "relative",
                  height: GRID_PX,
                  borderLeft: `1px solid ${token.colorBorderSecondary}`,
                  backgroundImage: `repeating-linear-gradient(to bottom, ${token.colorBorderSecondary} 0, ${token.colorBorderSecondary} 1px, transparent 1px, transparent ${HOUR_PX}px)`,
                  cursor: canSchedule ? "copy" : undefined,
                }}
                onClick={(ev) => {
                  if (!canSchedule || ev.target !== ev.currentTarget) return;
                  const y = ev.nativeEvent.offsetY;
                  const minutes = START_HOUR * 60 + Math.floor((y / HOUR_PX) * 4) * 15;
                  setSlot({ staffId: c.staffId, start: dayjs(`${c.day}T00:00`).add(minutes, "minute") });
                }}
              >
                {layout(eventsFor(c), timeZone).map(({ e, s, en, lane, lanes }) => {
                  const top = Math.max(0, ((s - START_HOUR * 60) / 60) * HOUR_PX);
                  const height = Math.max(22, ((en - s) / 60) * HOUR_PX - 2);
                  const isSession = e.kind === "session";
                  const color = !isSession ? token.colorWarningBg : e.status === "completed" ? token.colorSuccessBg : e.status === "missed" ? token.colorErrorBg : token.colorPrimaryBg;
                  const border = !isSession ? token.colorWarning : e.status === "completed" ? token.colorSuccess : e.status === "missed" ? token.colorError : token.colorPrimary;
                  const label = `${formatTime(e.start, timeZone)} to ${formatTime(e.end, timeZone)}, ${e.title}, ${e.subtitle}${view === "week" && !c.staffId ? `, with ${nameOf.get(e.staffProfileId) ?? ""}` : ""}`;
                  return (
                    <button
                      key={`${e.kind}-${e.id}`}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => setSelected(e)}
                      style={{
                        position: "absolute",
                        top,
                        height,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        background: color,
                        border: 0,
                        borderLeft: `3px solid ${border}`,
                        borderRadius: token.borderRadiusSM,
                        padding: "2px 6px",
                        textAlign: "left",
                        overflow: "hidden",
                        cursor: "pointer",
                        font: "inherit",
                        fontSize: token.fontSizeSM,
                        lineHeight: 1.35,
                        color: token.colorText,
                      }}
                    >
                      <strong>{formatTime(e.start, timeZone)}</strong> {e.title}
                      <div style={{ color: token.colorTextSecondary }}>
                        {e.subtitle}
                        {view === "week" && !c.staffId ? ` · ${nameOf.get(e.staffProfileId) ?? ""}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <Flex wrap gap={8} style={{ marginTop: 12 }}>
        <Tag color="processing">Scheduled session</Tag>
        <Tag color="success">Completed</Tag>
        <Tag color="error">Missed</Tag>
        <Tag color="warning">Appointment visit</Tag>
        <Typography.Text type="secondary">Times are in {timeZone}. Cancelled sessions are hidden.</Typography.Text>
      </Flex>

      {selected ? (
        <Drawer open onClose={() => setSelected(null)} title={selected.title} size={420}>
          <Descriptions
            size="small"
            column={1}
            items={[
              { key: "what", label: selected.kind === "session" ? "Therapy" : "Visit", children: selected.subtitle },
              { key: "when", label: "When", children: `${dayjs(local(selected.start, timeZone).ymd).format("ddd D MMM")} ${formatTime(selected.start, timeZone)} to ${formatTime(selected.end, timeZone)}` },
              { key: "who", label: "Therapist", children: nameOf.get(selected.staffProfileId) ?? "" },
              ...(selected.kind === "session"
                ? [{ key: "status", label: "Status", children: <Tag color={SESSION_STATUS_TAG[selected.status]}>{SESSION_STATUS_LABEL[selected.status]}</Tag> }]
                : []),
            ]}
          />
          <Space wrap style={{ marginTop: 16 }}>
            {selected.kind === "session" ? (
              <>
                <Link href={`/app/sessions/${selected.id}`}>Open session record</Link>
                {selected.patientId ? <Link href={`/app/patients/${selected.patientId}?tab=sessions`}>Open patient</Link> : null}
                {canSchedule && selected.status === "scheduled" ? (
                  <Button
                    onClick={() => {
                      setMoving(selected);
                      setSelected(null);
                    }}
                  >
                    Reschedule
                  </Button>
                ) : null}
              </>
            ) : (
              <Link href="/app/appointments?tab=scheduled">Open the appointment queue</Link>
            )}
          </Space>
        </Drawer>
      ) : null}

      {moving ? (
        <RescheduleDrawer
          session={{ id: moving.id, staffProfileId: moving.staffProfileId, scheduledStart: moving.start, scheduledEnd: moving.end, patientName: moving.title }}
          staff={therapists.map((t) => ({ id: t.id, fullName: t.name }))}
          timeZone={timeZone}
          onClose={() => setMoving(null)}
        />
      ) : null}

      {slot ? <ScheduleFromCalendar slot={slot} enrollments={props.enrollments} therapists={therapists} timeZone={timeZone} onClose={() => setSlot(null)} /> : null}
    </>
  );
}

type ScheduleValues = { enrollmentId: string; staffProfileId: string; start: Dayjs; durationMinutes: number; repeatWeeks: number };

function ScheduleFromCalendar({
  slot,
  enrollments,
  therapists,
  timeZone,
  onClose,
}: {
  slot: { staffId?: string; start?: Dayjs };
  enrollments: EnrollmentOption[];
  therapists: Therapist[];
  timeZone: string;
  onClose: () => void;
}) {
  const [form] = Form.useForm<ScheduleValues>();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(v: ScheduleValues) {
    setError(null);
    startTransition(async () => {
      const result = await scheduleSessionsAction({ ...v, start: pickerToIso(v.start, timeZone) });
      if (result.ok) {
        message.success({ content: v.repeatWeeks > 1 ? `${v.repeatWeeks} weekly sessions scheduled.` : "Session scheduled.", duration: 6 });
        onClose();
      } else if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Schedule session"
      size={520}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            Schedule
          </Button>
        </Flex>
      }
    >
      {enrollments.length === 0 ? (
        <Alert type="info" showIcon title="No open treatment plans" description="Enroll a patient in a therapy from the patient's Treatment tab first." />
      ) : (
        <Form<ScheduleValues>
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ staffProfileId: slot.staffId, start: slot.start ?? isoToPicker(new Date().toISOString(), timeZone).startOf("hour").add(1, "hour"), durationMinutes: 45, repeatWeeks: 1 }}
          onValuesChange={(changed: Partial<ScheduleValues>) => {
            if (changed.enrollmentId) {
              const e = enrollments.find((x) => x.id === changed.enrollmentId);
              if (e) form.setFieldsValue({ durationMinutes: e.sessionMinutes, ...(slot.staffId ? {} : e.leadStaffId ? { staffProfileId: e.leadStaffId } : {}) });
            }
          }}
        >
          {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
          <Typography.Paragraph type="secondary">Double-booking of the therapist or the patient is refused.</Typography.Paragraph>
          <Form.Item name="enrollmentId" label="Patient and therapy" rules={[{ required: true, message: "Please choose a treatment plan." }]}>
            <Select
              showSearch={{ optionFilterProp: "label" }}
              options={enrollments.map((e) => ({ value: e.id, label: `${e.patientName} (${e.trackingId}), ${e.therapyName}` }))}
            />
          </Form.Item>
          <Form.Item name="staffProfileId" label="Therapist" rules={[{ required: true, message: "Please choose a therapist." }]}>
            <Select showSearch={{ optionFilterProp: "label" }} options={therapists.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="start" label="Date and time" rules={[{ required: true, message: "Please choose a date and time." }]}>
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
      )}
    </Drawer>
  );
}
