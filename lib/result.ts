import type { z } from "zod";

/** Serializable outcome of a Server Action, for expected failures. */

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type ActionError = {
  code: ErrorCode;
  message: string;
  /** Field path (dot-joined, e.g. `offeredCourses.0.title`) to message. */
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, error: { code, message, fieldErrors } };
}

export function validationFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fail("VALIDATION", "Please check the highlighted fields.", fieldErrors);
}
