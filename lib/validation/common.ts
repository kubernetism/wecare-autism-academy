import { z } from "zod";

/** Empty strings and null from form fields mean "not provided". */
function emptyToUndefined(value: unknown) {
  if (value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export function optionalText(max: number, message?: string) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(max, message ?? `Please keep this under ${max} characters.`)
      .optional(),
  );
}

export function requiredText(min: number, max: number, label: string) {
  return z
    .string({ error: `Please enter ${label}.` })
    .trim()
    .min(min, min <= 1 ? `Please enter ${label}.` : `Please enter at least ${min} characters.`)
    .max(max, `Please keep this under ${max} characters.`);
}

export const phoneSchema = z
  .string({ error: "Please enter a phone number." })
  .trim()
  .min(7, "Please enter a phone number with at least 7 digits.")
  .max(20, "Please enter a shorter phone number.")
  .regex(/^\+?[0-9 ()-]+$/, "Use digits, spaces, brackets, dashes or a leading +.");

export const optionalPhoneSchema = z.preprocess(emptyToUndefined, phoneSchema.optional());

/** Web links only (no javascript: or data: URLs). */
export const optionalWebUrl = z.preprocess(
  emptyToUndefined,
  z
    .url({ protocol: /^https?$/, error: "Please enter a full web address starting with https://" })
    .max(500)
    .optional(),
);

export const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.email("Please enter a valid email address.").max(254).optional(),
);

export const uuidSchema = z.uuid("Invalid id.");

/** Hidden field that people never fill in; bots often do. */
export const honeypotSchema = z.preprocess(
  emptyToUndefined,
  z.string().max(0).optional(),
);
