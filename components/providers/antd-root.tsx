"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import enGB from "antd/locale/en_GB";
import type { ReactNode } from "react";
import { useReducedMotion } from "./use-reduced-motion";

/** The project body face first, then antd's default font stack. */
const FONT_FAMILY =
  "var(--font-atkinson), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

/**
 * Ant Design for the clinic app and parent portal only (the public website
 * does not use antd). Stock theme: the only visual setting is the font family
 * (the project's Atkinson Hyperlegible Next, then antd's default stack).
 * Functional settings: British English locale, server-side style extraction (no flash),
 * styles in the `antd` cascade layer (above Tailwind's reset), and motion
 * plus the click wave turned off when the user prefers reduced motion.
 */
export function AntdRoot({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <AntdRegistry layer>
      <ConfigProvider
        locale={enGB}
        theme={{ token: { fontFamily: FONT_FAMILY, ...(reducedMotion ? { motion: false } : {}) } }}
        wave={{ disabled: reducedMotion }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
