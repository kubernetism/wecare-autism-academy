import "server-only";
import { createDb, type Database } from "@/db/create-db";
import { requireEnv } from "./env";

/**
 * One pool per server instance. Created on first use so importing this module
 * (for example during `next build`) never needs a database.
 * In development the instance is kept on globalThis to survive hot reloads.
 */
const globalForDb = globalThis as unknown as { __wecareDb?: Database };

export function getDb(): Database {
  if (!globalForDb.__wecareDb) {
    globalForDb.__wecareDb = createDb(requireEnv("DATABASE_URL")).db;
  }
  return globalForDb.__wecareDb;
}
