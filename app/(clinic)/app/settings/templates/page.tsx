import { AccessDenied } from "@/components/clinic/access-denied";
import { PageHeader } from "@/components/clinic/page-header";
import { TemplateLibrary } from "@/components/clinic/template-library";
import { scopeFor } from "@/lib/permissions";
import { listTemplates } from "@/server/services/templates";
import { requireUser } from "@/server/session";

export const metadata = { title: "Record templates" };

export default async function TemplatesPage() {
  const user = await requireUser(["admin", "staff"], "/app/settings/templates");
  if (scopeFor(user, "update", "formTemplate") !== "all") return <AccessDenied />;
  const rows = await listTemplates(user);
  return (
    <>
      <PageHeader title="Record templates" description="The structured forms clinicians fill in for each therapy line and stage of treatment. Each record keeps the template version it was written with." />
      <TemplateLibrary rows={rows} />
    </>
  );
}
