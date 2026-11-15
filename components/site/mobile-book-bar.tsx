"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sticky "Book a visit" action on phones (hidden on the booking and auth pages). */
export function MobileBookBar() {
  const pathname = usePathname();
  if (pathname === "/book" || pathname === "/login" || pathname === "/register") return null;
  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden">
      <Link href="/book" className="flex min-h-12 items-center justify-center rounded-xl bg-harbour font-semibold text-surface">
        Book a visit
      </Link>
    </div>
  );
}
