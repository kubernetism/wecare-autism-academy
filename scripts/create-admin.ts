/**
 * Creates the first administrator account (the clinic owner).
 *
 *   ADMIN_EMAIL=owner@example.com ADMIN_NAME="Clinic Owner" ADMIN_PASSWORD=... \
 *     npm run db:create-admin
 *
 * Reads DATABASE_URL from the environment or .env.local. The password is
 * never printed. Further staff accounts are created by the admin in the app
 * (Settings > Users and roles).
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../db/create-db";
import { accounts, auditLog, users } from "../db/schema";
import { emailSchema, passwordSchema, personNameSchema } from "../lib/validation/auth";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const name = personNameSchema.parse(process.env.ADMIN_NAME ?? "Clinic Administrator");
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);

  const { db, pool } = createDb(url);
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      console.error(`An account with ${email} already exists. Nothing changed.`);
      process.exitCode = 1;
      return;
    }
    const userId = randomUUID();
    const hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: userId, name, email, role: "admin", emailVerified: false });
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hash,
      });
      await tx.insert(auditLog).values({
        actorUserId: null,
        action: "admin_account.bootstrap",
        entityType: "user",
        entityId: userId,
        after: { name, email, role: "admin" },
      });
    });
    console.log(`Admin account created for ${email}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
