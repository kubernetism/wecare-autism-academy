import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Lemonada, Sansation } from "next/font/google";
import "./globals.css";

/**
 * Root layout: shared by the website, parent portal and clinic app. The three
 * project fonts load once here (self-hosted by next/font, no third-party
 * request) and are exposed as CSS variables:
 * - Atkinson Hyperlegible Next: body and all UI/form text, website and app.
 * - Sansation: website headings.
 * - Lemonada: the website wordmark and a few short display accents only.
 * The website uses its own design system (Tailwind, no antd); the portal and
 * clinic app use stock Ant Design with only the font family set.
 */
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-atkinson",
  display: "swap",
});

const sansation = Sansation({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  style: ["normal", "italic"],
  variable: "--font-sansation",
  display: "swap",
});

const lemonada = Lemonada({
  subsets: ["latin"],
  variable: "--font-lemonada",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: {
    default: "WeCare Autism Academy",
    template: "%s | WeCare Autism Academy",
  },
  description:
    "Speech and language, occupational, ABA and physiotherapy for autistic children, planned around each child by one coordinated team.",
  applicationName: "WeCare Autism Academy",
  icons: { apple: "/pwa-icon/192" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} ${sansation.variable} ${lemonada.variable}`}>
      <body>{children}</body>
    </html>
  );
}
