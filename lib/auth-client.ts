"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/server/auth";

/** Browser client for Better Auth's HTTP endpoints (same origin). */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});
