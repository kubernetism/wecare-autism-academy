"use client";

import { Alert, App, Button, Card, Drawer, Flex, Form, Input, Space, Tag, Timeline, Typography } from "antd";
import Link from "next/link";
import { useState, useTransition } from "react";
import { RECORD_STATUS_LABEL, RECORD_STATUS_TAG, STAGE_LABEL } from "@/lib/labels";
import type { ActionResult } from "@/lib/result";
import type { TemplateAnswers } from "@/lib/templates/types";
import { formatDateTime } from "@/lib/time";
import { amendStageRecordAction, saveStageRecordAction, signStageRecordAction } from "@/server/actions/clinical";
import type { StageRecordView } from "@/server/services/clinical-records";
import { AnswersSummary, TemplateForm } from "./template-form";

/** Treatment plan, progress review and discharge records: draft, sign (locks), amend. */
export function StageRecordEditor({ record, isAdmin, timeZone }: { record: StageRecordView; isAdmin: boolean; timeZone: string }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<TemplateAnswers>();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amending, setAmending] = useState(false);
  const signed = record.status === "signed";

  function save(action: (input: unknown) => Promise<ActionResult<null>>, success: string) {
    setError(null);
    startTransition(async () => {
      const result = await action({ id: record.id, answers: form.getFieldsValue(true) });
      if (result.ok) {
        message.success({ content: success, duration: 6 });
        return;
      }
      if (result.error.fieldErrors) form.setFields(Object.entries(result.error.fieldErrors).map(([name, msg]) => ({ name, errors: [msg] })));
      setError(result.error.message);
    });
  }

  return (
    <>
      <Flex wrap justify="space-between" gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            {STAGE_LABEL[record.stage]}
          </Typography.Title>
          <Space wrap>
            <Link href={`/app/patients/${record.patientId}?tab=treatment`}>Back to the patient</Link>
            <Tag>{record.therapyName}</Tag>
            <Tag color={RECORD_STATUS_TAG[record.status]}>{RECORD_STATUS_LABEL[record.status]}</Tag>
            <Typography.Text type="secondary">Template version {record.template.version}</Typography.Text>
          </Space>
        </div>
        {signed && record.canEdit ? (
          <Button type="primary" onClick={() => setAmending(true)}>
            Amend
          </Button>
        ) : null}
      </Flex>

      {record.template.status === "draft" ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Draft record template"
          description={isAdmin ? "This template is a first draft for the clinic's clinicians to review. It is not a clinically validated instrument." : "This record template is a draft pending review by the clinic's clinicians."}
        />
      ) : null}

      <Card>
        {signed || !record.canEdit ? (
          <>
            {signed ? <Alert type="success" showIcon style={{ marginBottom: 16 }} title={`Signed ${record.signedAt ? formatDateTime(record.signedAt, timeZone) : ""}. The record is locked.`} /> : null}
            <AnswersSummary schema={record.template.schema} answers={record.current} />
          </>
        ) : (
          <>
            {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
            <TemplateForm schema={record.template.schema} form={form} initialValues={record.current} />
            <Flex wrap gap={8} justify="flex-end">
              <Button loading={pending} onClick={() => save(saveStageRecordAction, "Draft saved.")}>
                Save draft
              </Button>
              <Button type="primary" loading={pending} onClick={() => save(signStageRecordAction, "Record signed and locked.")}>
                Sign
              </Button>
            </Flex>
          </>
        )}
      </Card>

      {record.amendments.length > 0 ? (
        <Card title="Amendment history" style={{ marginTop: 16 }}>
          <Timeline items={record.amendments.map((a) => ({ key: String(a.version), content: `Amendment ${a.version} on ${formatDateTime(a.createdAt, timeZone)}: ${a.reason}` }))} />
          <Typography.Title level={5}>Original as signed</Typography.Title>
          <AnswersSummary schema={record.template.schema} answers={record.original} />
        </Card>
      ) : null}

      {amending ? <AmendDrawer record={record} onClose={() => setAmending(false)} /> : null}
    </>
  );
}

function AmendDrawer({ record, onClose }: { record: StageRecordView; onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<TemplateAnswers>();
  const [reasonForm] = Form.useForm<{ reason: string }>();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      await reasonForm.validateFields();
      await form.validateFields();
    } catch {
      return;
    }
    startTransition(async () => {
      const result = await amendStageRecordAction({ id: record.id, answers: form.getFieldsValue(true), reason: reasonForm.getFieldValue("reason") });
      if (result.ok) {
        message.success({ content: "Amendment saved. The original is kept.", duration: 6 });
        onClose();
        return;
      }
      if (result.error.fieldErrors) form.setFields(Object.entries(result.error.fieldErrors).map(([name, msg]) => ({ name, errors: [msg] })));
      setError(result.error.message);
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Amend signed record"
      size={720}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={pending} onClick={submit}>
            Save amendment
          </Button>
        </Flex>
      }
    >
      {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
      <Form form={reasonForm} layout="vertical">
        <Form.Item name="reason" label="Reason for the amendment" rules={[{ required: true, min: 5, message: "Please explain why the record is being changed." }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
      <TemplateForm schema={record.template.schema} form={form} initialValues={record.current} />
    </Drawer>
  );
}
