import { Inbox } from "@/components/clinic/inbox";
import { PageHeader } from "@/components/clinic/page-header";
import { MESSAGE_STATUSES, type MessageStatus } from "@/db/schema/enums";
import { env } from "@/server/env";
import { countInboxByStatus, listInbox } from "@/server/services/messages";
import { requireUser } from "@/server/session";
import { AccessDenied } from "@/components/clinic/access-denied";
import { scopeFor } from "@/lib/permissions";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: PageProps<"/app/inbox">) {
  const user = await requireUser(["admin", "staff"], "/app/inbox");
  if (scopeFor(user, "read", "message") !== "all") return <AccessDenied />;

  const params = await searchParams;
  const status: MessageStatus = MESSAGE_STATUSES.includes(params.status as MessageStatus)
    ? (params.status as MessageStatus)
    : "new";
  const [rows, counts] = await Promise.all([listInbox(user, status), countInboxByStatus(user)]);

  return (
    <>
      <PageHeader title="Inbox" description="Messages sent through the website contact form." />
      <Inbox key={status} rows={rows} counts={counts} status={status} timeZone={env.CLINIC_TIME_ZONE} />
    </>
  );
}
