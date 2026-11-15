import { Card, Skeleton } from "antd";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { AntdRoot } from "@/components/providers/antd-root";
import { requireUser } from "@/server/session";

export const metadata: Metadata = {
  title: { default: "Parent portal", template: "%s | WeCare parent portal" },
  robots: { index: false, follow: false },
};

async function PortalFrame({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["parent"], "/portal");
  return <PortalShell userName={user.name}>{children}</PortalShell>;
}

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <AntdRoot>
      <Suspense
        fallback={
          <Card style={{ margin: 24 }} aria-busy="true">
            <Skeleton active />
          </Card>
        }
      >
        <PortalFrame>{children}</PortalFrame>
      </Suspense>
    </AntdRoot>
  );
}
