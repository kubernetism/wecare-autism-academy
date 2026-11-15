"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, Col, DatePicker, Drawer, Flex, Form, Input, InputNumber, Row, Segmented, Select, Switch, Table, Tag } from "antd";
import type { TableProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STAFF_TYPES, type StaffType } from "@/db/schema/enums";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import { STAFF_TYPE_LABEL } from "@/lib/labels";
import { passwordSchema } from "@/lib/validation/auth";
import { createStaffAction, updateStaffAction } from "@/server/actions/clinical";
import type { StaffDetail, StaffRow } from "@/server/services/staff-profiles";

export function StaffDirectory({
  rows,
  type,
  active,
  therapies,
}: {
  rows: StaffRow[];
  type?: StaffType;
  active: boolean;
  therapies: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const go = (next: { type?: string | null; active?: boolean }) => {
    const params = new URLSearchParams();
    const t = next.type === undefined ? type : next.type;
    if (t) params.set("type", t);
    if ((next.active ?? active) === false) params.set("active", "inactive");
    startTransition(() => router.push(`${pathname}${params.size ? `?${params}` : ""}`));
  };

  const columns: TableProps<StaffRow>["columns"] = [
    { title: "Name", dataIndex: "fullName", render: (v: string, r) => <Link href={`/app/staff/${r.id}`}>{v}</Link> },
    { title: "Type", dataIndex: "staffType", render: (v: StaffType) => STAFF_TYPE_LABEL[v] },
    { title: "Title", dataIndex: "title", render: (v: string | null) => v ?? "" },
    { title: "Therapy lines", dataIndex: "therapyNames", render: (v: string[]) => v.join(", ") },
    { title: "Patients", dataIndex: "assignedPatients", width: 90 },
    {
      title: "Status",
      key: "status",
      render: (_, r) => (
        <Flex gap={4} wrap>
          {r.isVerified ? <Tag color="success">Verified</Tag> : <Tag>Not verified</Tag>}
          {r.hasLogin ? <Tag color="processing">Login</Tag> : null}
          {!r.active ? <Tag color="error">Inactive</Tag> : null}
        </Flex>
      ),
    },
  ];

  return (
    <>
      <Flex wrap gap={12} justify="space-between" style={{ marginBottom: 16 }}>
        <Flex wrap gap={12}>
          <Segmented
            value={type ?? "all"}
            onChange={(v) => go({ type: v === "all" ? null : (v as string) })}
            options={[{ label: "All types", value: "all" }, ...STAFF_TYPES.map((t) => ({ label: STAFF_TYPE_LABEL[t], value: t }))]}
          />
          <Segmented value={active ? "active" : "inactive"} onChange={(v) => go({ active: v === "active" })} options={[{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }]} />
        </Flex>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Add staff member
        </Button>
      </Flex>
      <Table<StaffRow> rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 900 }} pagination={{ pageSize: 25 }} locale={{ emptyText: "No staff here yet." }} />
      {creating ? <StaffFormDrawer therapies={therapies} onClose={() => setCreating(false)} /> : null}
    </>
  );
}

type StaffValues = {
  fullName: string;
  staffType: StaffType;
  title?: string;
  expertise?: string[];
  experienceYears?: number;
  therapySlugs?: string[];
  phone?: string;
  email?: string;
  joinedOn?: Dayjs;
  bio?: string;
  isVerified?: boolean;
  createLogin?: boolean;
  loginEmail?: string;
  loginPassword?: string;
};

/** Create (no `staff`) or edit (with `staff`) a staff profile. */
export function StaffFormDrawer({ staff, therapies, onClose }: { staff?: StaffDetail; therapies: { value: string; label: string }[]; onClose: () => void }) {
  const [form] = Form.useForm<StaffValues>();
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const staffType = Form.useWatch("staffType", form);
  const createLogin = Form.useWatch("createLogin", form);

  function submit(values: StaffValues) {
    setError(null);
    const payload = { ...values, joinedOn: values.joinedOn?.format("YYYY-MM-DD"), expertise: values.expertise ?? [], therapySlugs: values.therapySlugs ?? [], isVerified: values.isVerified ?? false };
    startTransition(async () => {
      const result = staff ? await updateStaffAction({ ...payload, id: staff.id }) : await createStaffAction({ ...payload, createLogin: values.createLogin ?? false });
      if (result.ok) {
        message.success(staff ? "Profile saved." : "Staff member added.");
        onClose();
        if (!staff && result.data && typeof result.data === "object" && "id" in result.data) router.push(`/app/staff/${(result.data as { id: string }).id}`);
        return;
      }
      if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={staff ? `Edit ${staff.fullName}` : "Add staff member"}
      size={640}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            {staff ? "Save" : "Add"}
          </Button>
        </Flex>
      }
    >
      <Form<StaffValues>
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={submit}
        initialValues={
          staff
            ? { ...staff, title: staff.title ?? undefined, phone: staff.phone ?? undefined, email: staff.email ?? undefined, bio: staff.bio ?? undefined, experienceYears: staff.experienceYears ?? undefined, joinedOn: staff.joinedOn ? dayjs(staff.joinedOn) : undefined }
            : { staffType: "specialist", isVerified: false, createLogin: false, expertise: [], therapySlugs: [] }
        }
      >
        {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
        <Row gutter={16}>
          <Col xs={24} md={14}>
            <Form.Item name="fullName" label="Full name" required rules={[{ required: true, min: 2, message: "Please enter the full name." }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name="staffType" label="Type" required rules={[{ required: true }]}>
              <Select options={STAFF_TYPES.map((t) => ({ value: t, label: STAFF_TYPE_LABEL[t] }))} disabled={Boolean(staff?.hasLogin)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item name="title" label="Job title">
              <Input placeholder="For example: Occupational therapist, Cook" />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name="experienceYears" label="Years of experience">
              <InputNumber min={0} max={80} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          {staffType !== "labour" ? (
            <>
              <Col xs={24}>
                <Form.Item name="therapySlugs" label="Therapy lines">
                  <Select mode="multiple" options={therapies} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item name="expertise" label="Expertise" extra="Type and press Enter to add.">
                  <Select mode="tags" tokenSeparators={[","]} />
                </Form.Item>
              </Col>
            </>
          ) : null}
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Phone">
              <Input type="tel" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Contact email">
              <Input type="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="joinedOn" label="Joined on">
              <DatePicker format="D MMM YYYY" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="isVerified" label="Credentials verified" valuePropName="checked" extra="Verified, active doctors and specialists appear on the website Team page.">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="bio" label="Short bio">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
          </Col>
          {!staff && staffType !== "labour" ? (
            <Col xs={24}>
              <Form.Item name="createLogin" valuePropName="checked">
                <Checkbox>Create a login for the clinic app</Checkbox>
              </Form.Item>
              {createLogin ? (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item name="loginEmail" label="Login email" required rules={[{ required: true, type: "email", message: "Please enter the login email." }]}>
                      <Input type="email" autoComplete="off" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="loginPassword" label="Temporary password" required rules={[zodRule(passwordSchema)]}>
                      <Input.Password autoComplete="new-password" />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null}
            </Col>
          ) : null}
        </Row>
      </Form>
    </Drawer>
  );
}
