import { notFound } from "next/navigation";
import { SessionWizard } from "@/components/clinic/session-wizard";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { getSessionWizard } from "@/server/services/sessions";
import { requireUser } from "@/server/session";

export const metadata = { title: "Session record" };

export default async function SessionRecordPage({ params }: PageProps<"/app/sessions/[id]">) {
  const user = await requireUser(["admin", "staff"], "/app/sessions");
  const { id } = await params;
  const data = await getSessionWizard(user, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return <SessionWizard key={`${id}-${data.amendments.length}-${data.session.recordStatus}`} data={data} isAdmin={user.role === "admin"} timeZone={env.CLINIC_TIME_ZONE} />;
}
