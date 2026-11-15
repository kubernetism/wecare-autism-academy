/**
 * Record template format: plain JSON stored in form_templates.schema.
 * Structured fields (coded options, scales, numbers) are preferred over free
 * text, because Phase 4's similar-case search relies on structured data.
 * Field keys are unique within a template; answers are stored by key.
 */

export type TemplateOption = { value: string; label: string };

type FieldBase = { key: string; label: string; required?: boolean; help?: string };

export type TemplateField =
  | (FieldBase & { type: "select"; options: TemplateOption[] })
  | (FieldBase & { type: "multiselect"; options: TemplateOption[] })
  | (FieldBase & { type: "scale"; min: number; max: number; anchors: [string, string] })
  | (FieldBase & { type: "number"; min: number; max: number; unit?: string; integer?: boolean })
  | (FieldBase & { type: "boolean" })
  | (FieldBase & { type: "text"; maxLength: number })
  | (FieldBase & { type: "textarea"; maxLength: number })
  | (FieldBase & { type: "date" });

export type TemplateSection = { key: string; title: string; fields: TemplateField[] };

export type TemplateSchema = { sections: TemplateSection[] };

export type TemplateAnswers = Record<string, unknown>;

export function templateFields(schema: TemplateSchema): TemplateField[] {
  return schema.sections.flatMap((s) => s.fields);
}
