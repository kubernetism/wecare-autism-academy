import type { FormInstance, FormRule } from "antd";
import type { z } from "zod";
import type { ActionError } from "./result";

/**
 * Bridges the shared Zod schemas to antd Form rules, so the browser shows the
 * same messages the server enforces. The server always re-validates.
 */
export function zodRule(schema: z.ZodType): FormRule {
  return {
    validator: async (_rule, value: unknown) => {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new Error(result.error.issues[0]?.message ?? "Please check this field.");
      }
    },
  };
}

/** Puts server-side field errors next to the matching antd fields. */
export function applyFieldErrors(form: FormInstance, error: ActionError): boolean {
  if (!error.fieldErrors) return false;
  const fields = Object.entries(error.fieldErrors).map(([path, message]) => ({
    name: path.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)),
    errors: [message],
  }));
  form.setFields(fields);
  return fields.length > 0;
}
