import { z } from "zod";
import { templateFields, type TemplateField, type TemplateSchema } from "./types";

/**
 * Builds the Zod validator for a template, shared by the form (client) and
 * the Server Actions. `draft` mode lets required fields stay empty so work can
 * be saved and resumed; `final` mode (sign-off) enforces them.
 */

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function fieldSchema(field: TemplateField): z.ZodType {
  const values = "options" in field ? field.options.map((o) => o.value) : [];
  switch (field.type) {
    case "select":
      return z.enum(values as [string, ...string[]], { error: `Choose an option for ${field.label}.` });
    case "multiselect":
      return z
        .array(z.enum(values as [string, ...string[]], { error: `Choose valid options for ${field.label}.` }))
        .max(values.length);
    case "scale":
      return z
        .number({ error: `Choose a value for ${field.label}.` })
        .int()
        .min(field.min, `${field.label} must be between ${field.min} and ${field.max}.`)
        .max(field.max, `${field.label} must be between ${field.min} and ${field.max}.`);
    case "number": {
      let n = z
        .number({ error: `Enter a number for ${field.label}.` })
        .min(field.min, `${field.label} must be at least ${field.min}.`)
        .max(field.max, `${field.label} must be at most ${field.max}.`);
      if (field.integer) n = n.int(`${field.label} must be a whole number.`);
      return n;
    }
    case "boolean":
      return z.boolean({ error: `Choose yes or no for ${field.label}.` });
    case "text":
    case "textarea":
      return z.string().trim().max(field.maxLength, `Keep ${field.label} under ${field.maxLength} characters.`);
    case "date":
      return z.iso.date(`Enter a valid date for ${field.label}.`);
  }
}

export type AnswerMode = "draft" | "final";

export function answersSchema(schema: TemplateSchema, mode: AnswerMode) {
  const fields = templateFields(schema);
  const known = new Set(fields.map((f) => f.key));
  return z
    .record(z.string(), z.unknown())
    .superRefine((answers, ctx) => {
      for (const key of Object.keys(answers)) {
        if (!known.has(key)) ctx.addIssue({ code: "custom", path: [key], message: "Unknown field." });
      }
      for (const field of fields) {
        const value = answers[field.key];
        if (isBlank(value)) {
          if (mode === "final" && field.required) {
            ctx.addIssue({ code: "custom", path: [field.key], message: `${field.label} is required to sign off.` });
          }
          continue;
        }
        const result = fieldSchema(field).safeParse(value);
        if (!result.success) {
          ctx.addIssue({ code: "custom", path: [field.key], message: result.error.issues[0]?.message ?? "Invalid value." });
        }
      }
    })
    .transform((answers) => {
      // Drop blank values so stored answers only contain what was entered.
      const clean: Record<string, unknown> = {};
      for (const field of fields) {
        const value = answers[field.key];
        if (!isBlank(value)) clean[field.key] = typeof value === "string" ? value.trim() : value;
      }
      return clean;
    });
}
