import "server-only";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/db/schema";
import { USER_ROLES } from "@/db/schema/enums";
import { emailSchema, personNameSchema, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/validation/auth";
import { getDb } from "./db";
import { env, requireEnv } from "./env";

function trustedOrigins(): string[] {
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}

function createAuth() {
  const db = getDb();
  return betterAuth({
    appName: "WeCare Autism Academy",
    baseURL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: requireEnv("BETTER_AUTH_SECRET"),
    trustedOrigins: trustedOrigins(),
    database: drizzleAdapter(db, { provider: "pg", usePlural: true, schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      autoSignIn: true,
      // No email provider in Phase 1. Turn on with verification emails later.
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        // `input: false`: the client can never set or change a role. Staff and
        // admin accounts are created by an admin through the service layer.
        role: {
          type: [...USER_ROLES],
          required: false,
          defaultValue: "parent",
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      // Shared store so limits hold across serverless instances.
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Deactivated staff cannot start a session.
          before: async (session) => {
            const [profile] = await db
              .select({ archivedAt: schema.staffProfiles.archivedAt })
              .from(schema.staffProfiles)
              .where(eq(schema.staffProfiles.userId, session.userId))
              .limit(1);
            if (profile?.archivedAt) {
              throw new APIError("FORBIDDEN", { message: "This account has been deactivated. Contact the clinic administrator." });
            }
            return { data: session };
          },
        },
      },
      user: {
        create: {
          // Self-registration through Better Auth is for parents only.
          before: async (user) => {
            const name = personNameSchema.safeParse(user.name);
            const email = emailSchema.safeParse(user.email);
            if (!name.success || !email.success) {
              throw new APIError("BAD_REQUEST", {
                message: "Please check your name and email address.",
              });
            }
            return {
              data: { ...user, name: name.data, email: email.data, role: "parent" },
            };
          },
          after: async (user) => {
            await db
              .insert(schema.parents)
              .values({ userId: user.id })
              .onConflictDoNothing({ target: schema.parents.userId });
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __wecareAuth?: Auth };

/** Created on first use so builds do not need secrets or a database. */
export function getAuth(): Auth {
  if (!globalForAuth.__wecareAuth) globalForAuth.__wecareAuth = createAuth();
  return globalForAuth.__wecareAuth;
}
