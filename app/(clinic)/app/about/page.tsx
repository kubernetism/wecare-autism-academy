import { AboutEditor } from "@/components/clinic/about-editor";
import { AccessDenied } from "@/components/clinic/access-denied";
import { PageHeader } from "@/components/clinic/page-header";
import { LinkButton } from "@/components/link-button";
import { scopeFor } from "@/lib/permissions";
import { getClinicProfileForEdit } from "@/server/services/clinic-profile";
import { requireUser } from "@/server/session";

export const metadata = { title: "About details" };

export default async function AboutDetailsPage() {
  const user = await requireUser(["admin", "staff"], "/app/about");
  if (scopeFor(user, "update", "clinicProfile") !== "all") return <AccessDenied />;
  const profile = await getClinicProfileForEdit(user);

  return (
    <>
      <PageHeader
        title="About details"
        description="The clinic's registered details, offered courses, sessions and recommended reading, as shown on the website."
        extra={
          <LinkButton href="/about" target="_blank">
            View on website
          </LinkButton>
        }
      />
      <AboutEditor profile={profile} />
    </>
  );
}
