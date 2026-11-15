import "server-only";
import { ForbiddenError } from "@/lib/permissions";
import { fail, type ActionResult } from "@/lib/result";
import { MissingConfigError } from "./env";

export class NotFoundError extends Error {
  constructor(message = "That record no longer exists.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** The record changed since it was loaded (e.g. someone else acted first). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Please sign in again.");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Maps known service errors to typed action results. Anything else is a bug
 * or an outage: log it server-side and show a generic message.
 */
export function toActionError(error: unknown, context: string): ActionResult<never> {
  if (error instanceof ForbiddenError) return fail("FORBIDDEN", error.message);
  if (error instanceof UnauthenticatedError) return fail("UNAUTHENTICATED", error.message);
  if (error instanceof NotFoundError) return fail("NOT_FOUND", error.message);
  if (error instanceof ConflictError) return fail("CONFLICT", error.message);
  if (error instanceof MissingConfigError) {
    console.error(`[${context}]`, error.message);
    return fail("UNAVAILABLE", "This service is not available right now. Please try again later.");
  }
  console.error(`[${context}] unexpected error`, error);
  return fail("UNKNOWN", "Something went wrong on our side. Please try again.");
}
