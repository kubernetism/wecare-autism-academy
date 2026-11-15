import { Flex, Skeleton } from "antd";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/clinic/app-shell";
import { AntdRoot } from "@/components/providers/antd-root";
import { SkeletonInput } from "@/components/ui";
import { navForActor } from "@/lib/clinic-nav";
import { countNewMessages } from "@/server/services/messages";
import { requireUser } from "@/server/session";

export const metadata: Metadata = {
  title: { default: "Clinic", template: "%s | WeCare Clinic" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "WeCare Clinic", statusBarStyle: "default" },
};

function ShellFallback() {
  return (
    <Flex vertical gap={16} style={{ padding: 24 }} aria-busy="true" aria-label="Loading the clinic app">
      <SkeletonInput active block />
      <Skeleton active paragraph={{ rows: 6 }} />
    </Flex>
  );
}

/** Reads the session, so it streams in behind the Suspense boundary. */
async function ClinicShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["admin", "staff"], "/app");
  const inboxCount = await countNewMessages(user);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      groups={navForActor(user)}
      inboxCount={inboxCount}
    >
      {children}
    </AppShell>
  );
}

export default function ClinicLayout({ children }: LayoutProps<"/app">) {
  return (
    <AntdRoot>
      <Suspense fallback={<ShellFallback />}>
        <ClinicShell>{children}</ClinicShell>
      </Suspense>
    </AntdRoot>
  );
}
