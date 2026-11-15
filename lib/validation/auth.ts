import { z } from "zod";

/** Shared by the login/register forms (client) and the auth server hooks. */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const personNameSchema = z
  .string({ error: "Please enter your full name." })
  .trim()
  .min(2, "Please enter your full name.")
  .max(80, "Please keep the name under 80 characters.");

export const emailSchema = z
  .string({ error: "Please enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email("Please enter a valid email address.").max(254));

export const passwordSchema = z
  .string({ error: "Please enter a password." })
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Please enter your password." }).min(1, "Please enter your password."),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    name: personNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "The passwords do not match.",
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * Only same-site paths are allowed as post-login destinations, so the `next`
 * query parameter can never send someone to another origin.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}
