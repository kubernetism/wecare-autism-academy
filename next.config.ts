import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  // Cache Components (`cacheComponents` / `partialPrefetching`, on by default
  // in create-next-app) is intentionally OFF: Ant Design's CSS-in-JS reads
  // `Date.now()` and `Math.random()` while rendering every component, which
  // Cache Components rejects during prerendering, so no route could build.
  // Public data is cached with `unstable_cache` + tags instead (see
  // server/services/clinic-profile.ts). Revisit when antd supports it.
  async redirects() {
    // Browsers request /favicon.ico by default; the icon is app/icon.svg.
    return [{ source: "/favicon.ico", destination: "/icon.svg", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
