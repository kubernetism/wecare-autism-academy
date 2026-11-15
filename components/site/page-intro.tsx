import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "./container";

/** Consistent opening block for inner website pages: breadcrumb, title, intro. */
export function PageIntro({
  title,
  intro,
  crumbs = [],
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  crumbs?: { href: string; label: string }[];
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface">
      <Container className="py-10 md:py-14">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            <li>
              <Link href="/" className="inline-flex min-h-11 items-center hover:text-harbour">
                Home
              </Link>
            </li>
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-2">
                <span aria-hidden>/</span>
                <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-harbour">
                  {c.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-[1.1] text-ink md:text-5xl">{title}</h1>
        {intro ? <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-ink-soft">{intro}</p> : null}
        {children}
      </Container>
    </div>
  );
}
