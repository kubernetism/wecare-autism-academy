import { Card, Result } from "antd";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/clinic/access-denied";
import { LinkButton } from "@/components/link-button";
import { findNavItem, isNavItemVisible } from "@/lib/clinic-nav";
import { requireUser } from "@/server/session";
import { Paragraph } from "@/components/ui";

/**
 * Sidebar modules that are not built yet get an honest placeholder. Unknown
 * paths 404, and modules outside the user's role show "no access" exactly as
 * the finished module will.
 */
export default async function ComingSoonPage({ params }: PageProps<"/app/[...module]">) {
  const { module } = await params;
  const item = findNavItem(`/app/${module.join("/")}`);
  if (!item?.comingInPhase) notFound();

  const user = await requireUser(["admin", "staff"], item.href);
  if (!isNavItemVisible(user, item)) return <AccessDenied />;

  return (
    <Card>
      <Result
        status="info"
        title={`${item.label} is coming in Phase ${item.comingInPhase}`}
        subTitle={
          <Paragraph type="secondary" style={{ maxWidth: "60ch", marginInline: "auto" }}>
            {item.summary} This module is part of a later release and is not available yet.
          </Paragraph>
        }
        extra={
          <LinkButton type="primary" href="/app">
            Back to dashboard
          </LinkButton>
        }
      />
    </Card>
  );
}
