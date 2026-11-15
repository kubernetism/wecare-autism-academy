"use client";

import { Alert, Button, Drawer, Form, Table, Tabs, Tag } from "antd";
import { useState } from "react";
import type { LifecycleStage, TemplateStatus } from "@/db/schema/enums";
import { STAGE_LABEL } from "@/lib/labels";
import { templateFields } from "@/lib/templates/types";
import type { TemplateListRow } from "@/server/services/templates";
import { TemplateForm } from "./template-form";

const STATUS_TAG: Record<TemplateStatus, { color: string; label: string }> = {
  draft: { color: "warning", label: "Draft, pending clinical review" },
  approved: { color: "success", label: "Approved" },
  retired: { color: "default", label: "Retired" },
};

export function TemplateLibrary({ rows }: { rows: TemplateListRow[] }) {
  const [preview, setPreview] = useState<TemplateListRow | null>(null);
  const [form] = Form.useForm();
  const lines = [...new Map(rows.map((r) => [r.therapySlug, r.therapyName])).entries()];

  return (
    <>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title="These templates are first drafts"
        description="They were written as a starting point using commonly used, named instruments and coded answers. They are not clinically validated. Please have the clinic's doctors and specialists review and adapt each one before relying on it. Changes are made as new versions, so existing records keep the version they were written with."
      />
      <Tabs
        items={lines.map(([slug, name]) => ({
          key: slug,
          label: name,
          children: (
            <Table<TemplateListRow>
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 640 }}
              dataSource={rows.filter((r) => r.therapySlug === slug)}
              columns={[
                { title: "Stage", dataIndex: "stage", render: (v: LifecycleStage) => STAGE_LABEL[v] },
                { title: "Title", dataIndex: "title" },
                { title: "Version", dataIndex: "version", width: 90, render: (v: number) => `v${v}` },
                { title: "Fields", key: "fields", width: 80, render: (_, r) => templateFields(r.schema).length },
                { title: "Status", dataIndex: "status", render: (v: TemplateStatus) => <Tag color={STATUS_TAG[v].color}>{STATUS_TAG[v].label}</Tag> },
                {
                  title: "",
                  key: "preview",
                  width: 100,
                  render: (_, r) => (
                    <Button size="small" onClick={() => setPreview(r)}>
                      Preview
                    </Button>
                  ),
                },
              ]}
            />
          ),
        }))}
      />
      {preview ? (
        <Drawer open onClose={() => setPreview(null)} title={`${preview.therapyName}: ${preview.title} (v${preview.version})`} size={720} destroyOnHidden>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Preview only. Fields marked with * are required before a record can be signed." />
          <TemplateForm schema={preview.schema} form={form} initialValues={{}} disabled />
        </Drawer>
      ) : null}
    </>
  );
}
