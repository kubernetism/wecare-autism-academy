"use client";

import {
  AccountBookOutlined,
  BellOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  FormOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  GlobalOutlined,
  IdcardOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { App, Avatar, Badge, Breadcrumb, Button, Dropdown, Flex, Input, Layout, Menu, Tag, Typography, theme } from "antd";
import type { MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import type { NavGroup, NavIconKey } from "@/lib/clinic-nav";
import { hardNavigate } from "@/lib/hard-navigate";
import { LiveClock } from "./live-clock";

const ICONS: Record<NavIconKey, ReactNode> = {
  dashboard: <DashboardOutlined />,
  appointments: <ScheduleOutlined />,
  calendar: <CalendarOutlined />,
  templates: <FormOutlined />,
  patients: <SolutionOutlined />,
  sessions: <MedicineBoxOutlined />,
  staff: <TeamOutlined />,
  profile: <IdcardOutlined />,
  attendance: <CheckSquareOutlined />,
  events: <BellOutlined />,
  accounts: <AccountBookOutlined />,
  invoices: <FileTextOutlined />,
  payments: <WalletOutlined />,
  expenses: <DollarOutlined />,
  blog: <ReadOutlined />,
  inbox: <InboxOutlined />,
  about: <InfoCircleOutlined />,
  users: <UsergroupAddOutlined />,
  settings: <SettingOutlined />,
};

const ROLE_LABEL = { admin: "Administrator", staff: "Staff", parent: "Parent" } as const;

export type ShellUser = { name: string; email: string; role: "admin" | "staff" | "parent" };

function selectedItem(pathname: string, groups: NavGroup[]) {
  let best: { href: string; label: string; group: string } | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      const match = item.href === "/app" ? pathname === "/app" : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.href.length)) best = { href: item.href, label: item.label, group: group.label };
    }
  }
  return best;
}

/**
 * Stock Ant Design admin layout (the official "responsive" Sider example):
 * dark Sider that collapses to zero width below `lg`, light Header,
 * Breadcrumb, a Content panel and a Footer. No custom styling.
 */
export function AppShell({
  user,
  groups,
  inboxCount,
  children,
}: {
  user: ShellUser;
  groups: NavGroup[];
  inboxCount: number | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  // Set by the Sider itself when the viewport crosses its `lg` breakpoint.
  const [isMobile, setIsMobile] = useState(false);
  const current = selectedItem(pathname, groups);

  async function signOut() {
    const { error } = await authClient.signOut();
    if (error) {
      message.error("Could not sign out. Please try again.");
      return;
    }
    hardNavigate("/login");
  }

  function search(value: string) {
    const q = value.trim();
    if (q.length >= 2) router.push(`/app/search?q=${encodeURIComponent(q)}`);
  }

  const menuItems: MenuProps["items"] = groups.map((group) => ({
    type: "group",
    key: group.key,
    label: group.label,
    children: group.items.map((item) => ({
      key: item.href,
      icon: ICONS[item.icon],
      label: (
        <Link href={item.href} onClick={() => isMobile && setCollapsed(true)}>
          {item.label}
          {item.comingInPhase ? (
            <Tag style={{ marginInlineStart: 8 }} color="default">
              Soon
            </Tag>
          ) : null}
        </Link>
      ),
    })),
  }));

  const profileMenu: MenuProps = {
    items: [
      {
        key: "who",
        disabled: true,
        label: (
          <Flex vertical>
            <Typography.Text strong>{user.name}</Typography.Text>
            <Typography.Text type="secondary">{user.email}</Typography.Text>
            <Typography.Text type="secondary">{ROLE_LABEL[user.role]}</Typography.Text>
          </Flex>
        ),
      },
      { type: "divider" },
      { key: "website", icon: <GlobalOutlined />, label: <Link href="/">View website</Link> },
      { key: "signout", icon: <LogoutOutlined />, label: "Sign out", onClick: () => void signOut() },
    ],
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        breakpoint="lg"
        collapsedWidth={0}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        onBreakpoint={setIsMobile}
        width={240}
        // No overflow on the Sider itself: it would clip the zero-width trigger.
        style={isMobile ? { position: "fixed", insetBlock: 0, zIndex: 100 } : undefined}
      >
        <Typography.Title level={4} style={{ color: "#fff", margin: 0, padding: "16px 24px" }}>
          WeCare Clinic
        </Typography.Title>
        <nav aria-label="Clinic" style={{ overflowY: "auto", maxHeight: "calc(100vh - 64px)" }}>
          <Menu theme="dark" mode="inline" items={menuItems} selectedKeys={current ? [current.href] : []} />
        </nav>
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ padding: "0 16px", background: colorBgContainer }}>
          <Flex align="center" gap={16} style={{ height: "100%" }}>
            <Input.Search
              placeholder="Search patients, tracking IDs, requests"
              aria-label="Search patients by name or tracking ID, and requests and messages by name, email or phone"
              allowClear
              onSearch={search}
              style={{ maxWidth: 360 }}
            />
            <Flex align="center" gap={16} style={{ marginInlineStart: "auto" }}>
              {!isMobile && <LiveClock />}
              {inboxCount !== null && (
                <Link href="/app/inbox" aria-label={`Inbox, ${inboxCount} new ${inboxCount === 1 ? "message" : "messages"}`}>
                  <Badge count={inboxCount} size="small">
                    <InboxOutlined style={{ fontSize: 18 }} />
                  </Badge>
                </Link>
              )}
              <Dropdown menu={profileMenu} trigger={["click"]} placement="bottomRight">
                <Button type="text" icon={<Avatar size="small" icon={<UserOutlined />} />} aria-label={`Account menu for ${user.name}`}>
                  {isMobile ? null : user.name}
                </Button>
              </Dropdown>
            </Flex>
          </Flex>
        </Layout.Header>
        <Layout.Content style={{ margin: "0 16px" }}>
          <Breadcrumb
            style={{ margin: "16px 0" }}
            items={[{ title: <Link href="/app">Clinic</Link> }, ...(current && current.href !== "/app" ? [{ title: current.label }] : [])]}
          />
          <main
            id="main"
            style={{ padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG }}
          >
            {children}
          </main>
        </Layout.Content>
        <Layout.Footer style={{ textAlign: "center" }}>WeCare Autism Academy clinic application</Layout.Footer>
      </Layout>
    </Layout>
  );
}
