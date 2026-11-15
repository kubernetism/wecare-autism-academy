import { AccessDenied } from "@/components/clinic/access-denied";
import { PageHeader } from "@/components/clinic/page-header";
import { StaffDirectory } from "@/components/clinic/staff-directory";
import { THERAPIES } from "@/content/therapies";
import { STAFF_TYPES, type StaffType } from "@/db/schema/enums";
import { scopeFor } from "@/lib/permissions";
import { listStaff } from "@/server/services/staff-profiles";
import { requireUser } from "@/server/session";

export const metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: PageProps<"/app/staff">) {
  const user = await requireUser(["admin", "staff"], "/app/staff");
  if (scopeFor(user, "read", "staffProfile") !== "all") return <AccessDenied />;
  const sp = await searchParams;
  const type = STAFF_TYPES.includes(sp.type as StaffType) ? (sp.type as StaffType) : undefined;
  const active = sp.active === "inactive" ? false : true;
  const rows = await listStaff(user, { type, active });
  return (
    <>
      <PageHeader title="Staff" description="Doctors, specialists and support staff. Support staff are records for attendance and payroll, without a login." />
      <StaffDirectory rows={rows} type={type} active={active} therapies={THERAPIES.map((t) => ({ value: t.slug, label: t.name }))} />
    </>
  );
}
