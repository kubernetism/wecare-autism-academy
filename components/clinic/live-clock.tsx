"use client";

import { Typography } from "antd";
import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 15_000);
  return () => window.clearInterval(id);
}

/** Minute-resolution clock. Renders nothing on the server (no mismatch). */
export function LiveClock() {
  const minute = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 60_000),
    () => null,
  );
  if (minute === null) return null;

  const now = new Date(minute * 60_000);
  const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <Typography.Text type="secondary" style={{ whiteSpace: "nowrap" }}>
      <time dateTime={now.toISOString()}>
        {date} · {time}
      </time>
    </Typography.Text>
  );
}
