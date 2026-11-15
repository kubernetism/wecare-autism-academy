"use client";

import { Checkbox, Col, DatePicker, Divider, Flex, Form, Input, InputNumber, Radio, Row, Select, Typography } from "antd";
import type { FormInstance, FormRule } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { ReactNode } from "react";
import type { TemplateAnswers, TemplateField, TemplateSchema } from "@/lib/templates/types";
import { fieldSchema } from "@/lib/templates/validate";

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Same per-field validation as the server; required fields are enforced at sign-off. */
function ruleFor(field: TemplateField): FormRule {
  const schema = fieldSchema(field);
  return {
    validator: async (_rule, value: unknown) => {
      if (isBlank(value)) return;
      const result = schema.safeParse(value);
      if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Please check this value.");
    },
  };
}

function control(field: TemplateField): ReactNode {
  switch (field.type) {
    case "select":
      return <Select allowClear placeholder="Choose" options={field.options} />;
    case "multiselect":
      return (
        <Checkbox.Group>
          <Row gutter={[8, 8]}>
            {field.options.map((o) => (
              <Col key={o.value} xs={24} sm={12} lg={8}>
                <Checkbox value={o.value}>{o.label}</Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      );
    case "scale":
      return (
        <Radio.Group optionType="button" buttonStyle="solid">
          {Array.from({ length: field.max - field.min + 1 }, (_, i) => field.min + i).map((n) => (
            <Radio.Button key={n} value={n}>
              {n}
            </Radio.Button>
          ))}
        </Radio.Group>
      );
    case "number":
      return <InputNumber min={field.min} max={field.max} precision={field.integer ? 0 : undefined} suffix={field.unit} style={{ width: 200 }} />;
    case "boolean":
      return (
        <Radio.Group
          options={[
            { label: "Yes", value: true },
            { label: "No", value: false },
          ]}
        />
      );
    case "text":
      return <Input maxLength={field.maxLength} />;
    case "textarea":
      return <Input.TextArea rows={3} maxLength={field.maxLength} showCount />;
    case "date":
      return <DatePicker format="D MMM YYYY" />;
  }
}

function extra(field: TemplateField): ReactNode {
  if (field.type === "scale") {
    return (
      <Flex justify="space-between" style={{ maxWidth: 260 }}>
        <Typography.Text type="secondary">
          {field.min} = {field.anchors[0]}
        </Typography.Text>
        <Typography.Text type="secondary">
          {field.max} = {field.anchors[1]}
        </Typography.Text>
      </Flex>
    );
  }
  return field.help;
}

/** Renders a record template. Answers are keyed by field key. */
export function TemplateForm({
  schema,
  form,
  initialValues,
  disabled,
  markRequired = true,
}: {
  schema: TemplateSchema;
  form: FormInstance<TemplateAnswers>;
  initialValues: TemplateAnswers;
  disabled?: boolean;
  /** Show which fields sign-off will require. */
  markRequired?: boolean;
}) {
  return (
    <Form form={form} layout="vertical" initialValues={initialValues} disabled={disabled} requiredMark={markRequired}>
      {schema.sections.map((section) => (
        <div key={section.key}>
          {schema.sections.length > 1 ? <Divider titlePlacement="start">{section.title}</Divider> : null}
          {section.fields.map((field) => (
            <Form.Item
              key={field.key}
              name={field.key}
              label={field.label}
              required={markRequired && field.required}
              rules={[ruleFor(field)]}
              extra={extra(field)}
              {...(field.type === "date"
                ? {
                    getValueProps: (value: unknown) => ({ value: typeof value === "string" && value ? dayjs(value) : undefined }),
                    normalize: (value: Dayjs | null) => (value ? value.format("YYYY-MM-DD") : undefined),
                  }
                : {})}
            >
              {control(field)}
            </Form.Item>
          ))}
        </div>
      ))}
    </Form>
  );
}

/** Read-only summary of answers (used for signed records and amendment history). */
export function AnswersSummary({ schema, answers }: { schema: TemplateSchema; answers: TemplateAnswers }) {
  const label = (field: TemplateField, value: unknown): string => {
    if (isBlank(value)) return "Not recorded";
    if (field.type === "select") return field.options.find((o) => o.value === value)?.label ?? String(value);
    if (field.type === "multiselect") return (value as string[]).map((v) => field.options.find((o) => o.value === v)?.label ?? v).join(", ");
    if (field.type === "boolean") return value ? "Yes" : "No";
    if (field.type === "number") return `${value}${field.unit ? ` ${field.unit}` : ""}`;
    if (field.type === "scale") return `${value} of ${field.max}`;
    return String(value);
  };
  return (
    <>
      {schema.sections.map((section) => (
        <div key={section.key}>
          {schema.sections.length > 1 ? <Divider titlePlacement="start">{section.title}</Divider> : null}
          {section.fields.map((field) => (
            <Row key={field.key} gutter={16} style={{ marginBottom: 8 }}>
              <Col xs={24} md={10}>
                <Typography.Text type="secondary">{field.label}</Typography.Text>
              </Col>
              <Col xs={24} md={14}>
                <Typography.Text style={{ whiteSpace: "pre-wrap" }}>{label(field, answers[field.key])}</Typography.Text>
              </Col>
            </Row>
          ))}
        </div>
      ))}
    </>
  );
}
