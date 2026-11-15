"use client";

import { LogoutOutlined } from "@ant-design/icons";
import { App, Button } from "antd";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/hard-navigate";

export function SignOutButton() {
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      icon={<LogoutOutlined />}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await authClient.signOut();
          if (error) {
            message.error("Could not sign out. Please try again.");
            return;
          }
          hardNavigate("/login");
        })
      }
    >
      Sign out
    </Button>
  );
}
