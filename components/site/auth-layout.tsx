import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Container } from "./container";

/** Two-column frame for the log in and register pages: form, then a calm explainer panel. */
export function AuthLayout({
  title,
  intro,
  points,
  children,
}: {
  title: string;
  intro: string;
  points: string[];
  children: ReactNode;
}) {
  return (
    <Container className="py-12 md:py-16">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="auth-title" className="rounded-3xl border border-line bg-surface p-6 md:p-10">
          <h1 id="auth-title" className="text-4xl font-semibold text-ink">
            {title}
          </h1>
          <p className="mt-3 max-w-[46ch] text-lg text-ink-soft">{intro}</p>
          <div className="mt-8">{children}</div>
        </section>
        <aside className="board-dots flex flex-col justify-center rounded-3xl p-6 md:p-10">
          <ul className="flex flex-col gap-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-2xl bg-surface p-4 font-semibold text-ink">
                <Check size={22} weight="bold" className="mt-0.5 shrink-0 text-harbour" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Container>
  );
}
