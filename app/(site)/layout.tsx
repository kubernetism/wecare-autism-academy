import type { Viewport } from "next";
import { MobileBookBar } from "@/components/site/mobile-book-bar";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import "./site.css";

export const viewport: Viewport = { themeColor: "#F5F7FA" };

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="site-root flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileBookBar />
    </div>
  );
}
