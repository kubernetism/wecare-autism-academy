import { z } from "zod";
import { THERAPY_SLUGS } from "@/content/therapies";
import { APPOINTMENT_TYPES, PREFERRED_TIMES } from "@/db/schema/enums";
import { emailSchema, personNameSchema } from "./auth";
import {
  honeypotSchema,
  optionalPhoneSchema,
  optionalText,
  phoneSchema,
  requiredText,
} from "./common";

/** Website booking form (appointment / demo session / introduction). */
export const bookingSchema = z.object({
  type: z.enum(APPOINTMENT_TYPES, { error: "Please choose what you would like to book." }),
  contactName: personNameSchema,
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  childName: optionalText(80),
  childAgeYears: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z
      .number({ error: "Please enter the age as a number." })
      .int("Please enter whole years.")
      .min(0, "Age cannot be negative.")
      .max(30, "Please check the age.")
      .optional(),
  ),
  therapySlug: z.preprocess(
    (v) => (v === null || v === "" || v === "unsure" ? undefined : v),
    z.enum(THERAPY_SLUGS).optional(),
  ),
  preferredDate: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.iso.date("Please choose a valid date.").optional(),
  ),
  preferredTime: z.enum(PREFERRED_TIMES).default("any"),
  message: optionalText(2000),
  website: honeypotSchema,
});
export type BookingInput = z.input<typeof bookingSchema>;
export type BookingData = z.output<typeof bookingSchema>;

/** Website contact form; lands in the clinic inbox. */
export const contactSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
  subject: requiredText(3, 120, "a subject"),
  message: requiredText(10, 4000, "your message"),
  website: honeypotSchema,
});
export type ContactInput = z.input<typeof contactSchema>;
export type ContactData = z.output<typeof contactSchema>;
