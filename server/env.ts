import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once. Everything is optional at parse time so
 * `next build` works without secrets (for example in CI); the getters below
 * throw a clear error at runtime when a required value is missing.
 */
const schema = z.object({
  DATABASE_URL: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  /** IANA zone the clinic works in, e.g. "Asia/Karachi". Defaults to UTC. */
  CLINIC_TIME_ZONE: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone")
    .default("UTC"),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Report which variables are malformed without echoing their values.
  const names = parsed.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid environment variables: ${names.join(", ")}`);
}

export const env = parsed.data;

export class MissingConfigError extends Error {
  constructor(name: string) {
    super(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
    this.name = "MissingConfigError";
  }
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

export function requireEnv<K extends keyof typeof env>(name: K): string {
  const value = env[name];
  if (!value) throw new MissingConfigError(name);
  return value;
}
