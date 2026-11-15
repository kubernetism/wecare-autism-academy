import { PageHeader } from "@/components/clinic/page-header";
import { PatientTable } from "@/components/clinic/patient-table";
import { scopeFor } from "@/lib/permissions";
import { patientListQuerySchema } from "@/lib/validation/clinical";
import { listPatients } from "@/server/services/patients";
import { therapistOptions } from "@/server/services/sessions";
import { requireUser } from "@/server/session";

export const metadata = { title: "Patients" };

export default async function PatientsPage({ searchParams }: PageProps<"/app/patients">) {
  const user = await requireUser(["admin", "staff"], "/app/patients");
  const query = patientListQuerySchema.parse(await searchParams);
  const canAdmit = scopeFor(user, "create", "patient") === "all";
  const [{ rows, total }, staff] = await Promise.all([listPatients(user, query), canAdmit ? therapistOptions() : Promise.resolve([])]);

  return (
    <>
      <PageHeader
        title="Patients"
        description={canAdmit ? "Search by name or tracking ID. Admit new patients here." : "Patients assigned to you."}
      />
      <PatientTable rows={rows} total={total} query={query} canAdmit={canAdmit} staff={staff} />
    </>
  );
}
