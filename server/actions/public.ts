"use server";

import { fail, ok, validationFailure, type ActionResult } from "@/lib/result";
import { bookingSchema, contactSchema } from "@/lib/validation/public-forms";
import { toActionError } from "../errors";
import { consumeRateLimit } from "../rate-limit";
import { createAppointmentRequest } from "../services/appointments";
import { createContactMessage } from "../services/messages";
import { getCurrentUser } from "../session";

const TOO_MANY = "You have sent several requests in a short time. Please wait a few minutes and try again.";

/** Website booking form: appointment, demo session or introduction. */
export async function submitBooking(input: unknown): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  // Honeypot filled in: pretend success, store nothing.
  if (parsed.data.website) return ok(null);

  try {
    if (!(await consumeRateLimit("booking", { max: 5, windowSeconds: 600 }))) {
      return fail("RATE_LIMITED", TOO_MANY);
    }
    const actor = await getCurrentUser();
    await createAppointmentRequest(actor, parsed.data);
    return ok(null);
  } catch (error) {
    return toActionError(error, "submitBooking");
  }
}

/** Website contact form; lands in the clinic inbox. */
export async function submitContact(input: unknown): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  if (parsed.data.website) return ok(null);

  try {
    if (!(await consumeRateLimit("contact", { max: 5, windowSeconds: 600 }))) {
      return fail("RATE_LIMITED", TOO_MANY);
    }
    const actor = await getCurrentUser();
    await createContactMessage(actor, parsed.data);
    return ok(null);
  } catch (error) {
    return toActionError(error, "submitContact");
  }
}
