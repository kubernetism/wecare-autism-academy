import { AccessDenied } from "@/components/clinic/access-denied";
import { PageHeader } from "@/components/clinic/page-header";
import { StaffAccounts } from "@/components/clinic/staff-accounts";
import { THERAPIES } from "@/content/therapies";
import { scopeFor } from "@/lib/permissions";
import { env } from "@/server/env";
import { listStaffAccounts } from "@/server/services/staff";
import { requireUser } from "@/server/session";

export const metadata = { title: "Users and roles" };

export default async function UsersPage() {
  const user = await requireUser(["admin", "staff"], "/app/settings/users");
  if (scopeFor(user, "read", "user") !== "all") return <AccessDenied />;
  const accounts = await listStaffAccounts(user);

  return (
    <>
      <PageHeader
        title="Users and roles"
        description="Clinic logins. Staff accounts are created here by an administrator; parents register themselves on the website."
      />
      <StaffAccounts
        accounts={accounts}
        therapyOptions={THERAPIES.map((t) => ({ value: t.slug, label: t.name }))}
        timeZone={env.CLINIC_TIME_ZONE}
      />
    </>
  );
}
