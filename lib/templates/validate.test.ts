import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_TEMPLATES } from "@/content/form-templates";
import { THERAPY_SLUGS } from "@/content/therapies";
import { LIFECYCLE_STAGES } from "@/db/schema/enums";
import { templateFields, type TemplateSchema } from "./types";
import { answersSchema } from "./validate";

const sample: TemplateSchema = {
  sections: [
    {
      key: "s",
      title: "S",
      fields: [
        { type: "select", key: "mode", label: "Mode", required: true, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] },
        { type: "scale", key: "eng", label: "Engagement", min: 1, max: 5, anchors: ["Low", "High"], required: true },
        { type: "number", key: "acc", label: "Accuracy", min: 0, max: 100, integer: true },
        { type: "multiselect", key: "tags", label: "Tags", options: [{ value: "x", label: "X" }] },
        { type: "textarea", key: "notes", label: "Notes", maxLength: 10 },
      ],
    },
  ],
};

describe("template answer validation", () => {
  it("lets drafts leave required fields empty", () => {
    expect(answersSchema(sample, "draft").safeParse({ acc: 50 }).success).toBe(true);
  });

  it("requires required fields at sign-off", () => {
    const result = answersSchema(sample, "final").safeParse({ acc: 50 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["mode", "eng"]));
  });

  it("rejects values outside the coded options and ranges", () => {
    const result = answersSchema(sample, "draft").safeParse({ mode: "z", eng: 9, acc: 50.5, tags: ["y"], notes: "x".repeat(11) });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(["acc", "eng", "mode", "notes", "tags"]);
  });

  it("rejects unknown keys and strips blanks", () => {
    expect(answersSchema(sample, "draft").safeParse({ extra: 1 }).success).toBe(false);
    const ok = answersSchema(sample, "final").parse({ mode: "a", eng: 3, notes: "  ", tags: [] });
    expect(ok).toEqual({ mode: "a", eng: 3 });
  });
});

describe("seed templates", () => {
  it("cover every therapy line and lifecycle stage", () => {
    for (const slug of THERAPY_SLUGS) {
      for (const stage of LIFECYCLE_STAGES) {
        expect(SEED_TEMPLATES.some((t) => t.slug === slug && t.stage === stage), `${slug} ${stage}`).toBe(true);
      }
    }
  });

  it("use unique field keys and mostly structured fields", () => {
    for (const t of SEED_TEMPLATES) {
      const fields = templateFields(t.schema);
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size, `${t.slug} ${t.stage}`).toBe(keys.length);
      const freeText = fields.filter((f) => f.type === "text" || f.type === "textarea").length;
      expect(freeText / fields.length, `${t.slug} ${t.stage} free-text share`).toBeLessThanOrEqual(0.5);
    }
  });

  it("match the generated seed migration", () => {
    const sql = readFileSync("db/migrations/0005_seed_form_templates.sql", "utf8");
    for (const t of SEED_TEMPLATES) {
      expect(sql).toContain(JSON.stringify(t.schema).replace(/'/g, "''"));
    }
  });
});
