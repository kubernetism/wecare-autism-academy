"use client";

import { MailOutlined } from "@ant-design/icons";
import { App, Badge, Button, Card, Descriptions, Drawer, Empty, Flex, Table, Tabs, Typography } from "antd";
import type { TableProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MessageStatus } from "@/db/schema/enums";
import { MESSAGE_STATUS_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/time";
import { updateMessageStatus } from "@/server/actions/clinic";
import type { MessageRow } from "@/server/services/messages";

const TABS: { key: MessageStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "read", label: "Read" },
  { key: "archived", label: "Archived" },
];

export function Inbox({
  rows,
  counts,
  status,
  timeZone,
}: {
  rows: MessageRow[];
  counts: Record<MessageStatus, number>;
  status: MessageStatus;
  timeZone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { message } = App.useApp();
  const [navigating, startNavigation] = useTransition();
  const [selected, setSelected] = useState<MessageRow | null>(null);
  const [updating, startUpdate] = useTransition();

  function setStatus(row: MessageRow, next: MessageStatus, successText?: string) {
    startUpdate(async () => {
      const result = await updateMessageStatus({ id: row.id, status: next });
      if (!result.ok) {
        message.error({ content: result.error.message, duration: 8 });
        return;
      }
      setSelected((current) => (current?.id === row.id ? { ...current, status: next } : current));
      if (successText) message.success({ content: successText, duration: 6 });
    });
  }

  function open(row: MessageRow) {
    setSelected(row);
    if (row.status === "new") setStatus(row, "read");
  }

  const columns: TableProps<MessageRow>["columns"] = [
    {
      title: "From",
      key: "from",
      width: 260,
      render: (_, row) => (
        <Flex vertical>
          <Typography.Text strong={row.status === "new"}>{row.senderName}</Typography.Text>
          <Typography.Text type="secondary" ellipsis>
            {row.senderEmail}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Subject",
      key: "subject",
      render: (_, row) => (
        <Button type="link" onClick={() => open(row)} style={{ padding: 0, height: "auto", textAlign: "start", whiteSpace: "normal" }}>
          {row.status === "new" ? <Badge status="processing" text={row.subject} /> : row.subject}
        </Button>
      ),
    },
    {
      title: "Received",
      dataIndex: "createdAt",
      width: 220,
      render: (value: string) => formatDateTime(value, timeZone),
    },
  ];

  const empty = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={status === "new" ? "No new messages. Messages from the contact form appear here." : `No ${MESSAGE_STATUS_LABEL[status].toLowerCase()} messages.`}
    />
  );

  return (
    <Card>
      <Tabs
        activeKey={status}
        onChange={(key) => startNavigation(() => router.push(`${pathname}?status=${key}`))}
        items={TABS.map((t) => ({ key: t.key, label: `${t.label} (${counts[t.key]})` }))}
      />
      <Table<MessageRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={navigating}
        pagination={false}
        locale={{ emptyText: empty }}
        scroll={{ x: 640 }}
      />
      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        size={600}
        title={selected?.subject}
        footer={
          selected && (
            <Flex wrap gap={8}>
              {selected.senderEmail && (
                <Button type="primary" icon={<MailOutlined />} href={`mailto:${selected.senderEmail}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}>
                  Reply by email
                </Button>
              )}
              {selected.status !== "new" && selected.status !== "archived" && (
                <Button loading={updating} onClick={() => setStatus(selected, "new", "Marked as unread.")}>
                  Mark as unread
                </Button>
              )}
              {selected.status === "archived" ? (
                <Button loading={updating} onClick={() => setStatus(selected, "read", "Moved back to the inbox.")}>
                  Move to inbox
                </Button>
              ) : (
                <Button loading={updating} onClick={() => setStatus(selected, "archived", "Message archived.")}>
                  Archive
                </Button>
              )}
            </Flex>
          )
        }
      >
        {selected && (
          <Flex vertical gap={16}>
            <Descriptions
              column={1}
              size="small"
              items={[
                { key: "from", label: "From", children: selected.senderName },
                ...(selected.senderEmail ? [{ key: "email", label: "Email", children: <a href={`mailto:${selected.senderEmail}`}>{selected.senderEmail}</a> }] : []),
                ...(selected.senderPhone ? [{ key: "phone", label: "Phone", children: <a href={`tel:${selected.senderPhone.replace(/[^+0-9]/g, "")}`}>{selected.senderPhone}</a> }] : []),
                { key: "received", label: "Received", children: formatDateTime(selected.createdAt, timeZone) },
                { key: "status", label: "Status", children: MESSAGE_STATUS_LABEL[selected.status] },
              ]}
            />
            <Typography.Paragraph style={{ whiteSpace: "pre-wrap", maxWidth: "68ch" }}>{selected.body}</Typography.Paragraph>
          </Flex>
        )}
      </Drawer>
    </Card>
  );
}
