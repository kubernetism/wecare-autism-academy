import "server-only";
import type { z } from "zod";
import { fail, ok, validationFailure, type ActionResult } from "@/lib/result";
import { toActionError, UnauthenticatedError } from "../errors";
import { getCurrentUser, type CurrentUser } from "../session";

/**
 * Every Server Action goes through here: validate input with the shared Zod
 * schema, re-authenticate, then call a service that checks permissions with
 * `can()`. Page-level gates are never relied on.
 */
export async function runAction<S extends z.ZodType, T>(
  name: string,
  schema: S,
  input: unknown,
  body: (actor: CurrentUser, data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const actor = await getCurrentUser();
    if (!actor) throw new UnauthenticatedError();
    return ok(await body(actor, parsed.data));
  } catch (error) {
    return toActionError(error, name);
  }
}

/** Services that validate template answers return field errors instead of throwing. */
export function withFieldErrors<T extends { fieldErrors?: Record<string, string> }>(result: ActionResult<T>): ActionResult<null> {
  if (!result.ok) return result;
  if (result.data.fieldErrors && Object.keys(result.data.fieldErrors).length > 0) {
    return fail("VALIDATION", "Please check the highlighted fields.", result.data.fieldErrors);
  }
  return ok(null);
}
