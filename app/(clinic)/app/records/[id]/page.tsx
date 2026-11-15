import { notFound } from "next/navigation";
import { StageRecordEditor } from "@/components/clinic/stage-record-editor";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { getStageRecord } from "@/server/services/clinical-records";
import { requireUser } from "@/server/session";

export const metadata = { title: "Clinical record" };

export default async function StageRecordPage({ params }: PageProps<"/app/records/[id]">) {
  const user = await requireUser(["admin", "staff"], "/app/patients");
  const { id } = await params;
  const record = await getStageRecord(user, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return <StageRecordEditor key={`${id}-${record.status}-${record.amendments.length}`} record={record} isAdmin={user.role === "admin"} timeZone={env.CLINIC_TIME_ZONE} />;
}
