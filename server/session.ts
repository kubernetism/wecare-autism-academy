import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { parents, staffProfiles, users } from "@/db/schema";
import type { UserRole } from "@/db/schema/enums";
import type { Actor } from "@/lib/permissions";
import { getAuth } from "./auth";
import { getDb } from "./db";

/**
 * Data Access Layer entry point: who is making this request?
 * The session is validated by Better Auth against the database on every call
 * (no cookie cache), then the role and profile ids are read fresh from the
 * database. Deduplicated per request with React `cache`.
 */

export type CurrentUser = Actor & { name: string; email: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read the request first: it marks the route dynamic before anything that
  // needs configuration (auth secret, database) runs.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const [row] = await getDb()
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      staffProfileId: staffProfiles.id,
      staffArchivedAt: staffProfiles.archivedAt,
      parentId: parents.id,
    })
    .from(users)
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .leftJoin(parents, eq(parents.userId, users.id))
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row) return null;
  // A deactivated staff member's login no longer grants access.
  if (row.role === "staff" && row.staffArchivedAt) return null;
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    staffProfileId: row.staffProfileId,
    parentId: row.parentId,
  };
});

export function homePathFor(role: UserRole): string {
  return role === "parent" ? "/portal" : "/app";
}

/**
 * Page/layout gate. Not a security boundary on its own: services re-check
 * permissions with `can()` for every read and write.
 */
export async function requireUser(
  allowed: readonly UserRole[],
  nextPath: string,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!allowed.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}
