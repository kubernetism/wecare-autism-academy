"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Affix, Alert, App, Button, Card, Col, Empty, Flex, Form, Input, Row, Typography } from "antd";
import { useState, useTransition } from "react";
import type { z } from "zod";
import { applyFieldErrors, zodRule } from "@/lib/form-rules";
import {
  bookItemSchema,
  clinicProfileSchema,
  courseItemSchema,
  learningSourceItemSchema,
  sessionItemSchema,
  type ClinicProfileInput,
} from "@/lib/validation/clinic";
import { saveClinicProfile } from "@/server/actions/clinic";
import type { ClinicProfile } from "@/server/services/clinic-profile";

type FieldSpec = {
  key: string;
  label: string;
  schema: z.ZodType;
  multiline?: boolean;
  placeholder?: string;
  span?: number;
};

const shape = clinicProfileSchema.shape;

function ListSection({
  name,
  title,
  description,
  addLabel,
  fields,
  emptyText,
}: {
  name: keyof ClinicProfileInput;
  title: string;
  description: string;
  addLabel: string;
  fields: FieldSpec[];
  emptyText: string;
}) {
  return (
    <Card title={title} style={{ marginBottom: 16 }}>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      <Form.List name={name}>
        {(items, { add, remove }) => (
          <Flex vertical gap={12}>
            {items.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}
            {items.map((item, index) => (
              <Card key={item.key} size="small" type="inner">
                <Row gutter={12}>
                  {fields.map((field) => (
                    <Col key={field.key} xs={24} md={field.span ?? 12}>
                      <Form.Item
                        name={[item.name, field.key]}
                        label={field.label}
                        rules={[zodRule(field.schema)]}
                        style={{ marginBottom: 12 }}
                      >
                        {field.multiline ? (
                          <Input.TextArea rows={2} placeholder={field.placeholder} />
                        ) : (
                          <Input placeholder={field.placeholder} />
                        )}
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(item.name)}
                  aria-label={`Remove item ${index + 1} from ${title}`}
                >
                  Remove
                </Button>
              </Card>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})} style={{ alignSelf: "flex-start" }}>
              {addLabel}
            </Button>
          </Flex>
        )}
      </Form.List>
    </Card>
  );
}

export function AboutEditor({ profile }: { profile: ClinicProfile }) {
  const [form] = Form.useForm<ClinicProfileInput>();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(values: ClinicProfileInput) {
    setError(null);
    startTransition(async () => {
      const result = await saveClinicProfile(values);
      if (result.ok) {
        message.success({ content: "About details saved. The website shows them now.", duration: 6 });
        return;
      }
      applyFieldErrors(form, result.error);
      setError(result.error.message);
    });
  }

  return (
    <Form<ClinicProfileInput>
      form={form}
      layout="vertical"
      requiredMark="optional"
      initialValues={{
        registeredName: profile.registeredName,
        address: profile.address ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        openingHours: profile.openingHours ?? "",
        offeredCourses: profile.offeredCourses,
        sessions: profile.sessions,
        recommendedBooks: profile.recommendedBooks,
        learningSources: profile.learningSources,
      }}
      onFinish={submit}
      onFinishFailed={() => setError("Please check the highlighted fields.")}
      scrollToFirstError={{ behavior: "smooth", block: "center" }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}

      <Card title="Clinic details" style={{ marginBottom: 16 }}>
        <Typography.Paragraph type="secondary">
          Shown on the website About and Contact pages. Leave a field empty until it is confirmed; the website then says
          it is to be confirmed instead of showing a guess.
        </Typography.Paragraph>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="registeredName" label="Registered name" required rules={[zodRule(shape.registeredName)]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[zodRule(shape.email)]}>
              <Input type="email" placeholder="name@example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Contact phone" rules={[zodRule(shape.phone)]}>
              <Input type="tel" placeholder="+00 000 0000000" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="openingHours" label="Opening hours" rules={[zodRule(shape.openingHours)]}>
              <Input placeholder="For example: Monday to Saturday, 9:00 to 17:00" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="address" label="Address" rules={[zodRule(shape.address)]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <ListSection
        name="offeredCourses"
        title="Offered courses"
        description="Programmes or courses the clinic offers, for example parent training."
        addLabel="Add course"
        emptyText="No courses added yet."
        fields={[
          { key: "title", label: "Title", schema: courseItemSchema.shape.title },
          { key: "description", label: "Description", schema: courseItemSchema.shape.description, multiline: true },
        ]}
      />
      <ListSection
        name="sessions"
        title="Sessions"
        description="Session formats families can book, with their usual length."
        addLabel="Add session"
        emptyText="No sessions added yet."
        fields={[
          { key: "title", label: "Name", schema: sessionItemSchema.shape.title },
          { key: "duration", label: "Usual length", schema: sessionItemSchema.shape.duration, placeholder: "For example: 45 minutes" },
          { key: "description", label: "Description", schema: sessionItemSchema.shape.description, multiline: true, span: 24 },
        ]}
      />
      <ListSection
        name="recommendedBooks"
        title="Recommended books"
        description="Books the team recommends to families."
        addLabel="Add book"
        emptyText="No books added yet."
        fields={[
          { key: "title", label: "Title", schema: bookItemSchema.shape.title },
          { key: "author", label: "Author", schema: bookItemSchema.shape.author },
          { key: "url", label: "Link (optional)", schema: bookItemSchema.shape.url, placeholder: "https://" },
          { key: "note", label: "Why we recommend it", schema: bookItemSchema.shape.note },
        ]}
      />
      <ListSection
        name="learningSources"
        title="Recommended learning sources"
        description="Websites, videos or organisations families can learn from."
        addLabel="Add source"
        emptyText="No learning sources added yet."
        fields={[
          { key: "title", label: "Title", schema: learningSourceItemSchema.shape.title },
          { key: "url", label: "Link", schema: learningSourceItemSchema.shape.url, placeholder: "https://" },
          { key: "note", label: "Note", schema: learningSourceItemSchema.shape.note, span: 24 },
        ]}
      />

      <Affix offsetBottom={0}>
        <Card size="small">
          <Flex justify="flex-end">
            <Button type="primary" htmlType="submit" loading={pending}>
              Save About details
            </Button>
          </Flex>
        </Card>
      </Affix>
    </Form>
  );
}
