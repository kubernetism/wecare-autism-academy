import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { rateLimits } from "@/db/schema";
import { getDb } from "./db";

/**
 * Fixed-window limiter for public form submissions, stored in Postgres so it
 * holds across serverless instances. Shares Better Auth's `rate_limits` table;
 * our keys are prefixed with `form:` so they never collide with its own.
 */
export async function consumeRateLimit(
  name: string,
  { max, windowSeconds }: { max: number; windowSeconds: number },
): Promise<boolean> {
  const key = `form:${name}:${await clientIp()}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const [row] = await getDb()
    .insert(rateLimits)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.lastRequest} < ${windowStart} then 1 else ${rateLimits.count} + 1 end`,
        lastRequest: sql`case when ${rateLimits.lastRequest} < ${windowStart} then ${now} else ${rateLimits.lastRequest} end`,
      },
    })
    .returning({ count: rateLimits.count });

  return (row?.count ?? 1) <= max;
}

/** On Vercel `x-forwarded-for` is set by the platform; first hop is the client. */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}
