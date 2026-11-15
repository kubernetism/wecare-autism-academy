"use client";

import { Alert, App, Button, Card, Descriptions, Drawer, Flex, Form, Input, Radio, Result, Select, Space, Steps, Tag, Timeline, Typography } from "antd";
import type { FormInstance } from "antd";
import Link from "next/link";
import { useState, useTransition } from "react";
import { SESSION_OUTCOMES, type SessionOutcome } from "@/db/schema/enums";
import { OUTCOME_LABEL, RECORD_STATUS_LABEL, RECORD_STATUS_TAG, SESSION_STATUS_LABEL, SESSION_STATUS_TAG } from "@/lib/labels";
import type { TemplateAnswers } from "@/lib/templates/types";
import { formatDateTime } from "@/lib/time";
import { WIZARD_STEPS, type WizardStep } from "@/lib/validation/clinical";
import { amendSessionAction, saveSessionStepAction, signOffSessionAction } from "@/server/actions/clinical";
import type { SessionRecordContent, SessionWizardData } from "@/server/services/sessions";
import { AnswersSummary, TemplateForm } from "./template-form";

const COLUMN: Record<WizardStep, keyof Pick<SessionRecordContent, "historyAnswers" | "assessmentAnswers" | "noteAnswers">> = {
  history: "historyAnswers",
  assessment: "assessmentAnswers",
  notes: "noteAnswers",
};
const STEP_TITLE: Record<WizardStep, string> = { history: "History and symptoms", assessment: "Assessment", notes: "Plan and session notes" };
const SIMILAR = 3;
const SIGNOFF = 4;

export function SessionWizard({ data, isAdmin, timeZone }: { data: SessionWizardData; isAdmin: boolean; timeZone: string }) {
  const { session, templates, current } = data;
  const signed = session.recordStatus === "signed";
  const draftTemplates = WIZARD_STEPS.some((s) => templates[s].status === "draft");

  return (
    <>
      <Flex wrap justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Session record
          </Typography.Title>
          <Space wrap>
            <Link href={`/app/patients/${session.patientId}?tab=sessions`}>
              {session.patientName} ({session.trackingId})
            </Link>
            <Tag>{session.therapyName}</Tag>
            <Tag color={SESSION_STATUS_TAG[session.status]}>{SESSION_STATUS_LABEL[session.status]}</Tag>
            <Tag color={RECORD_STATUS_TAG[session.recordStatus]}>{RECORD_STATUS_LABEL[session.recordStatus]}</Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {formatDateTime(session.scheduledStart, timeZone)} with {session.staffName}
          </Typography.Paragraph>
        </div>
      </Flex>

      {draftTemplates ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Draft record templates"
          description={
            isAdmin
              ? "These templates are first drafts for the clinic's clinicians to review and adapt. They are not clinically validated instruments. Review them under Settings, Record templates."
              : "These record templates are drafts pending review by the clinic's clinicians."
          }
        />
      ) : null}

      {signed ? <SignedView data={data} timeZone={timeZone} /> : data.canEdit ? <DraftWizard data={data} /> : <ReadOnly data={data} content={current} />}
    </>
  );
}

function ReadOnly({ data, content }: { data: SessionWizardData; content: SessionRecordContent }) {
  return (
    <Card>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title="You can view this record but not edit it." />
      {WIZARD_STEPS.map((step) => (
        <div key={step}>
          <Typography.Title level={4}>{STEP_TITLE[step]}</Typography.Title>
          <AnswersSummary schema={data.templates[step].schema} answers={content[COLUMN[step]]} />
        </div>
      ))}
    </Card>
  );
}

function DraftWizard({ data }: { data: SessionWizardData }) {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, Record<string, string>> | null>(null);
  const [history] = Form.useForm<TemplateAnswers>();
  const [assessment] = Form.useForm<TemplateAnswers>();
  const [notes] = Form.useForm<TemplateAnswers>();
  const [signoff] = Form.useForm<{ doctorNote: string; outcome: SessionOutcome }>();
  const forms: Record<WizardStep, FormInstance<TemplateAnswers>> = { history, assessment, notes };

  function applyErrors(stepKey: WizardStep, errors: Record<string, string>) {
    forms[stepKey].setFields(Object.entries(errors).map(([name, msg]) => ({ name, errors: [msg] })));
  }

  async function saveStep(stepKey: WizardStep, advance: boolean) {
    setError(null);
    try {
      await forms[stepKey].validateFields();
    } catch {
      setError("Please fix the highlighted fields before saving.");
      return;
    }
    const answers = forms[stepKey].getFieldsValue(true);
    startTransition(async () => {
      const result = await saveSessionStepAction({ sessionId: data.session.id, step: stepKey, answers });
      if (result.ok) {
        message.success({ content: `${STEP_TITLE[stepKey]} saved as draft.`, duration: 4 });
        if (advance) setStep((s) => s + 1);
      } else {
        if (result.error.fieldErrors) applyErrors(stepKey, result.error.fieldErrors);
        setError(result.error.message);
      }
    });
  }

  function signOff(values: { doctorNote: string; outcome: SessionOutcome }) {
    setError(null);
    setStepErrors(null);
    startTransition(async () => {
      // Save any unsaved changes on the three record steps first.
      for (const s of WIZARD_STEPS) {
        const saved = await saveSessionStepAction({ sessionId: data.session.id, step: s, answers: forms[s].getFieldsValue(true) });
        if (!saved.ok) {
          if (saved.error.fieldErrors) applyErrors(s, saved.error.fieldErrors);
          setStep(WIZARD_STEPS.indexOf(s));
          setError(saved.error.message);
          return;
        }
      }
      const result = await signOffSessionAction({ sessionId: data.session.id, ...values });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.stepErrors) {
        setStepErrors(result.data.stepErrors);
        for (const [s, errs] of Object.entries(result.data.stepErrors)) applyErrors(s as WizardStep, errs);
        setStep(WIZARD_STEPS.indexOf(Object.keys(result.data.stepErrors)[0] as WizardStep));
        setError("Some required fields are missing. They are highlighted on the steps marked in red.");
        return;
      }
      message.success({ content: "Record signed off and locked.", duration: 6 });
    });
  }

  const items = [
    ...WIZARD_STEPS.map((s) => ({ title: STEP_TITLE[s], status: stepErrors?.[s] ? ("error" as const) : undefined })),
    { title: "Similar cases" },
    { title: "Doctor note and sign-off" },
  ];

  return (
    <Card>
      <Steps current={step} onChange={setStep} items={items} responsive style={{ marginBottom: 24 }} />
      {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} /> : null}
      {WIZARD_STEPS.map((s, i) => (
        <div key={s} hidden={step !== i}>
          <Typography.Paragraph type="secondary">
            {data.templates[s].title}, template version {data.templates[s].version}. Fields marked with * are required to sign off.
          </Typography.Paragraph>
          <TemplateForm schema={data.templates[s].schema} form={forms[s]} initialValues={data.current[COLUMN[s]]} />
          <Flex wrap gap={8} justify="flex-end">
            <Button loading={pending} onClick={() => saveStep(s, false)}>
              Save draft
            </Button>
            <Button type="primary" loading={pending} onClick={() => saveStep(s, true)}>
              Save and continue
            </Button>
          </Flex>
        </div>
      ))}
      <div hidden={step !== SIMILAR}>
        <Result
          status="info"
          title="Similar cases: coming in Phase 4"
          subTitle="This step will search de-identified past records for similar cases and summarise what was tried. It is decision support only, not a diagnosis. Nothing is searched or sent anywhere yet."
          extra={
            <Button type="primary" onClick={() => setStep(SIGNOFF)}>
              Continue to sign-off
            </Button>
          }
        />
      </div>
      <div hidden={step !== SIGNOFF}>
        <Form form={signoff} layout="vertical" onFinish={signOff} initialValues={{ doctorNote: data.current.doctorNote ?? "", outcome: data.current.outcome ?? undefined }}>
          <Form.Item name="outcome" label="Overall session outcome" rules={[{ required: true, message: "Please choose the session outcome." }]}>
            <Radio.Group optionType="button" options={SESSION_OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} />
          </Form.Item>
          <Form.Item name="doctorNote" label="Doctor note" rules={[{ required: true, min: 3, message: "Please write the doctor note." }]}>
            <Input.TextArea rows={5} maxLength={3000} showCount />
          </Form.Item>
          <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Signing off locks the record. Later changes are made as amendments, and the original is kept." />
          <Flex justify="flex-end">
            <Button type="primary" htmlType="submit" loading={pending}>
              Sign off
            </Button>
          </Flex>
        </Form>
      </div>
    </Card>
  );
}

function SignedView({ data, timeZone }: { data: SessionWizardData; timeZone: string }) {
  const [amending, setAmending] = useState(false);
  const { current, original, amendments, session } = data;
  return (
    <Flex vertical gap={16}>
      <Card
        title="Signed record"
        extra={
          data.canEdit ? (
            <Button type="primary" onClick={() => setAmending(true)}>
              Amend
            </Button>
          ) : null
        }
      >
        <Descriptions
          size="small"
          column={{ xs: 1, md: 2 }}
          items={[
            { key: "signed", label: "Signed", children: session.signedAt ? formatDateTime(session.signedAt, timeZone) : "" },
            { key: "outcome", label: "Outcome", children: current.outcome ? OUTCOME_LABEL[current.outcome] : "" },
            { key: "note", label: "Doctor note", children: <span style={{ whiteSpace: "pre-wrap" }}>{current.doctorNote}</span>, span: 2 },
            { key: "version", label: "Version", children: amendments.length ? `Amendment ${amendments.length} (original kept)` : "Original" },
          ]}
        />
        {WIZARD_STEPS.map((step) => (
          <div key={step} style={{ marginTop: 16 }}>
            <Typography.Title level={4}>{STEP_TITLE[step]}</Typography.Title>
            <AnswersSummary schema={data.templates[step].schema} answers={current[COLUMN[step]]} />
          </div>
        ))}
      </Card>
      {amendments.length > 0 ? (
        <Card title="Amendment history">
          <Timeline
            items={[
              { key: "original", content: `Original signed ${session.signedAt ? formatDateTime(session.signedAt, timeZone) : ""}. Doctor note: ${original.doctorNote ?? ""}` },
              ...amendments.map((a) => ({ key: String(a.version), content: `Amendment ${a.version} on ${formatDateTime(a.createdAt, timeZone)}${a.amendedBy ? ` by ${a.amendedBy}` : ""}: ${a.reason}` })),
            ]}
          />
        </Card>
      ) : null}
      {amending ? <AmendDrawer data={data} onClose={() => setAmending(false)} /> : null}
    </Flex>
  );
}

function AmendDrawer({ data, onClose }: { data: SessionWizardData; onClose: () => void }) {
  const { message } = App.useApp();
  const [target, setTarget] = useState<WizardStep | "signoff">("notes");
  const [answersForm] = Form.useForm<TemplateAnswers>();
  const [metaForm] = Form.useForm<{ reason: string; doctorNote?: string; outcome?: SessionOutcome }>();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await metaForm.validateFields();
      if (target !== "signoff") await answersForm.validateFields();
    } catch {
      return;
    }
    const meta = metaForm.getFieldsValue(true);
    startTransition(async () => {
      const result = await amendSessionAction({
        sessionId: data.session.id,
        step: target,
        reason: meta.reason,
        ...(target === "signoff" ? { doctorNote: meta.doctorNote, outcome: meta.outcome } : { answers: answersForm.getFieldsValue(true) }),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.stepErrors) {
        const errs = result.data.stepErrors[target] ?? Object.values(result.data.stepErrors)[0] ?? {};
        answersForm.setFields(Object.entries(errs).map(([name, msg]) => ({ name, errors: [msg] })));
        setError("Some required fields are missing.");
        return;
      }
      message.success({ content: "Amendment saved. The original is kept.", duration: 6 });
      onClose();
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
      <Form form={metaForm} layout="vertical" initialValues={{ doctorNote: data.current.doctorNote ?? "", outcome: data.current.outcome ?? undefined }}>
        <Form.Item label="Part to amend">
          <Select
            value={target}
            onChange={setTarget}
            options={[...WIZARD_STEPS.map((s) => ({ value: s, label: STEP_TITLE[s] })), { value: "signoff", label: "Doctor note and outcome" }]}
          />
        </Form.Item>
        {target === "signoff" ? (
          <>
            <Form.Item name="outcome" label="Overall session outcome" rules={[{ required: true }]}>
              <Radio.Group optionType="button" options={SESSION_OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} />
            </Form.Item>
            <Form.Item name="doctorNote" label="Doctor note" rules={[{ required: true, min: 3 }]}>
              <Input.TextArea rows={5} maxLength={3000} />
            </Form.Item>
          </>
        ) : null}
        <Form.Item name="reason" label="Reason for the amendment" rules={[{ required: true, min: 5, message: "Please explain why the record is being changed." }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
      {target !== "signoff" ? <TemplateForm key={target} schema={data.templates[target].schema} form={answersForm} initialValues={data.current[COLUMN[target]]} /> : null}
    </Drawer>
  );
}
