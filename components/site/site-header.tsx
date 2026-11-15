"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";

const NAV = [
  { href: "/therapies", label: "Therapies" },
  { href: "/team", label: "Team" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-ink-soft transition-colors hover:bg-mist hover:text-ink aria-[current=page]:text-harbour";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Close the mobile menu with Escape and return focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="WeCare Autism Academy home" className="inline-flex min-h-11 items-center rounded-xl">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass} aria-current={isActive(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
          <span aria-hidden className="mx-3 h-6 w-px bg-line" />
          <Link href="/login" className={linkClass} aria-current={pathname === "/login" ? "page" : undefined}>
            Log in
          </Link>
          <Link
            href="/book"
            className="ml-2 inline-flex min-h-11 items-center rounded-xl bg-harbour px-5 font-semibold text-surface transition-colors hover:bg-harbour-deep"
          >
            Book a visit
          </Link>
        </nav>

        <button
          ref={buttonRef}
          type="button"
          className="grid size-11 place-items-center rounded-xl border border-line text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} aria-hidden /> : <List size={22} aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-paper px-4 pb-5 pt-2 lg:hidden">
          <ul className="flex flex-col">
            {[...NAV, { href: "/login", label: "Log in" }].map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className="flex min-h-12 items-center rounded-xl px-3 text-lg font-semibold text-ink hover:bg-mist aria-[current=page]:text-harbour"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/book"
            onClick={() => setOpen(false)}
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-harbour font-semibold text-surface"
          >
            Book a visit
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
