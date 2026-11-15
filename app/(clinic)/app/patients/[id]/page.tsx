import { notFound } from "next/navigation";
import { PatientWorkspace, type WorkspaceTab } from "@/components/clinic/patient-workspace";
import { THERAPIES } from "@/content/therapies";
import { can, scopeFor } from "@/lib/permissions";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { patientAuditTrail } from "@/server/services/audit-trail";
import { listEnrollments } from "@/server/services/enrollments";
import { listFiles } from "@/server/services/files";
import { loadPatientScope } from "@/server/services/patient-access";
import { getPatient } from "@/server/services/patients";
import { listSessions, therapistOptions } from "@/server/services/sessions";
import { getDb } from "@/server/db";
import { requireUser } from "@/server/session";

export const metadata = { title: "Patient" };

const TABS: WorkspaceTab[] = ["overview", "treatment", "sessions", "files", "prescriptions", "reports", "finance", "audit"];

export default async function PatientPage({ params, searchParams }: PageProps<"/app/patients/[id]">) {
  const user = await requireUser(["admin", "staff"], "/app/patients");
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as WorkspaceTab) ? (sp.tab as WorkspaceTab) : "overview";
  const page = Math.max(1, Number(sp.page) || 1);

  let patient;
  try {
    patient = await getPatient(user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const scope = await loadPatientScope(getDb(), id);
  if (!scope) notFound();

  const isAdmin = scopeFor(user, "create", "patient") === "all";
  const perms = {
    manage: isAdmin,
    editDetails: can(user, "update", { type: "patient", patient: scope }),
    writeRecords: can(user, "create", { type: "clinicalRecord", kind: "goal", patient: scope }),
    uploadFiles: can(user, "create", { type: "medicalFile", patient: scope }),
    deleteFiles: can(user, "delete", { type: "medicalFile", patient: scope }),
    markAttendanceAll: isAdmin,
    staffProfileId: user.staffProfileId,
  };

  const [enrollments, sessions, files, audit, staff] = await Promise.all([
    tab === "treatment" || tab === "overview" ? listEnrollments(user, id) : Promise.resolve([]),
    tab === "sessions" ? listSessions(user, { patientId: id, page, pageSize: 20, order: "desc" }) : Promise.resolve({ rows: [], total: 0 }),
    tab === "files" ? listFiles(user, id) : Promise.resolve([]),
    tab === "audit" ? patientAuditTrail(user, id) : Promise.resolve([]),
    isAdmin ? therapistOptions() : Promise.resolve([]),
  ]);

  return (
    <PatientWorkspace
      key={`${id}-${tab}`}
      patient={patient}
      tab={tab}
      page={page}
      enrollments={enrollments}
      sessions={sessions}
      files={files}
      audit={audit}
      staff={staff}
      therapies={THERAPIES.map((t) => ({ slug: t.slug, name: t.name }))}
      perms={perms}
      timeZone={env.CLINIC_TIME_ZONE}
    />
  );
}
