"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Drawer, Empty, Flex, Form, Input, Radio, Select, Table, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import { useState, useTransition } from "react";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import { formatDate } from "@/lib/time";
import { createStaffAccountSchema, type CreateStaffAccountInput } from "@/lib/validation/clinic";
import { addStaffAccount } from "@/server/actions/clinic";
import type { StaffAccountRow } from "@/server/services/staff";

const ROLE_LABEL = { admin: "Administrator", staff: "Staff", parent: "Parent" } as const;
const TYPE_LABEL = { doctor: "Doctor", specialist: "Specialist", labour: "Support staff" } as const;
const shape = createStaffAccountSchema.shape;

export function StaffAccounts({
  accounts,
  therapyOptions,
  timeZone,
}: {
  accounts: StaffAccountRow[];
  therapyOptions: { value: string; label: string }[];
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);

  const columns: TableProps<StaffAccountRow>["columns"] = [
    {
      title: "Name",
      key: "name",
      render: (_, row) => (
        <Flex vertical>
          <Typography.Text strong>{row.name}</Typography.Text>
          <Typography.Text type="secondary">{row.email}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Role",
      key: "role",
      render: (_, row) => (
        <Flex gap={4} wrap>
          <Tag color={row.role === "admin" ? "processing" : "default"}>{ROLE_LABEL[row.role]}</Tag>
          {row.staffType && <Tag>{TYPE_LABEL[row.staffType]}</Tag>}
        </Flex>
      ),
    },
    { title: "Title", dataIndex: "title", render: (v: string | null) => v ?? <Typography.Text type="secondary">None</Typography.Text> },
    {
      title: "Therapy lines",
      dataIndex: "therapyNames",
      render: (names: string[]) => (names.length ? names.join(", ") : <Typography.Text type="secondary">None</Typography.Text>),
    },
    { title: "Created", dataIndex: "createdAt", render: (v: string) => formatDate(v, timeZone) },
  ];

  return (
    <Card
      title={`${accounts.length} clinic ${accounts.length === 1 ? "login" : "logins"}`}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Add staff account
        </Button>
      }
    >
      <Table<StaffAccountRow>
        rowKey="userId"
        columns={columns}
        dataSource={accounts}
        pagination={false}
        scroll={{ x: 720 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No clinic logins yet." /> }}
      />
      {open && <CreateStaffDrawer therapyOptions={therapyOptions} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function CreateStaffDrawer({
  therapyOptions,
  onClose,
}: {
  therapyOptions: { value: string; label: string }[];
  onClose: () => void;
}) {
  const [form] = Form.useForm<CreateStaffAccountInput>();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(values: CreateStaffAccountInput) {
    setError(null);
    startTransition(async () => {
      const result = await addStaffAccount(values);
      if (result.ok) {
        message.success({ content: `Account created for ${values.name}. Share the temporary password with them in person.`, duration: 8 });
        onClose();
        return;
      }
      if (!applyFieldErrors(form, result.error) || result.error.code !== "VALIDATION") setError(result.error.message);
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Add staff account"
      size={520}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={pending} onClick={() => form.submit()}>
            Create account
          </Button>
        </Flex>
      }
    >
      <Form<CreateStaffAccountInput>
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ staffType: "specialist", therapySlugs: [] }}
        onFinish={submit}
      >
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Form.Item name="name" label="Full name" required rules={[zodRule(shape.name)]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="email" label="Email (used to sign in)" required rules={[zodRule(shape.email)]}>
          <Input type="email" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Temporary password"
          required
          rules={[zodRule(shape.password)]}
          extra="At least 10 characters. Share it privately; password change and reset arrive with email support."
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="staffType" label="Staff type" required rules={[zodRule(shape.staffType)]}>
          <Radio.Group
            options={[
              { value: "doctor", label: "Doctor" },
              { value: "specialist", label: "Specialist / therapist" },
            ]}
          />
        </Form.Item>
        <Form.Item name="title" label="Job title" rules={[zodRule(shape.title)]}>
          <Input placeholder="For example: Speech and language therapist" />
        </Form.Item>
        <Form.Item name="therapySlugs" label="Therapy lines">
          <Select mode="multiple" options={therapyOptions} placeholder="Choose one or more" />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          Support staff without a login (for attendance and payroll) are added in the Staff module in Phase 2.
        </Typography.Paragraph>
      </Form>
    </Drawer>
  );
}
