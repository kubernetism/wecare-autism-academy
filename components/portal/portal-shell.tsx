"use client";

import { Flex, Layout, Typography, theme } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";

/** Stock Ant Design top-navigation layout: dark Header, Content panel, Footer. */
export function PortalShell({ userName, children }: { userName: string; children: ReactNode }) {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header>
        <Flex align="center" justify="space-between" gap={16} style={{ height: "100%", maxWidth: 1120, margin: "0 auto" }}>
          <Link href="/portal">
            <Typography.Title level={4} style={{ color: "#fff", margin: 0 }}>
              WeCare parent portal
            </Typography.Title>
          </Link>
          <Flex align="center" gap={12}>
            <Typography.Text style={{ color: "rgba(255,255,255,0.85)" }}>{userName}</Typography.Text>
            <SignOutButton />
          </Flex>
        </Flex>
      </Layout.Header>
      <Layout.Content style={{ padding: "24px 16px" }}>
        <main
          id="main"
          style={{ maxWidth: 1120, margin: "0 auto", padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}
        >
          {children}
        </main>
      </Layout.Content>
      <Layout.Footer style={{ textAlign: "center" }}>
        WeCare Autism Academy. <Link href="/">Back to the website</Link>
      </Layout.Footer>
    </Layout>
  );
}
