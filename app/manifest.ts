import type { MetadataRoute } from "next";

/** Makes the clinic app installable (opens straight into /app). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "WeCare Clinic",
    short_name: "WeCare",
    description: "WeCare Autism Academy clinic application for administrators and staff.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FCF7F5",
    theme_color: "#3E4761",
    categories: ["medical", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
