import { PageHeader } from "@/components/clinic/page-header";
import { SessionsList } from "@/components/clinic/sessions-list";
import { SESSION_STATUSES, type SessionStatus } from "@/db/schema/enums";
import { env } from "@/server/env";
import { listSessions } from "@/server/services/sessions";
import { requireUser } from "@/server/session";

export const metadata = { title: "Therapy sessions" };

export default async function SessionsPage({ searchParams }: PageProps<"/app/sessions">) {
  const user = await requireUser(["admin", "staff"], "/app/sessions");
  const sp = await searchParams;
  const view = sp.view === "past" ? "past" : "upcoming";
  const status = SESSION_STATUSES.includes(sp.status as SessionStatus) ? (sp.status as SessionStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();
  const result = await listSessions(user, {
    from: view === "upcoming" ? new Date(now.getTime() - 12 * 3_600_000) : undefined,
    to: view === "past" ? now : undefined,
    status,
    page,
    pageSize: 20,
    order: view === "past" ? "desc" : "asc",
  });
  return (
    <>
      <PageHeader
        title="Therapy sessions"
        description={user.role === "admin" ? "All scheduled and past sessions. Open a session to write or review its record." : "Sessions you run or for patients assigned to you."}
      />
      <SessionsList result={result} view={view} status={status} page={page} timeZone={env.CLINIC_TIME_ZONE} />
    </>
  );
}
