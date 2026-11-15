import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { JourneyBoard } from "@/components/site/journey-board";
import { PageIntro } from "@/components/site/page-intro";
import { btnPrimary, btnSecondary } from "@/components/site/styles";
import { TherapyIcon } from "@/components/site/therapy-icon";
import { THERAPIES } from "@/content/therapies";

export const metadata: Metadata = {
  title: "Therapies",
  description:
    "Speech and Language Pathology, Occupational Therapy, Applied Behavior Analysis (ABA) and Physiotherapy at WeCare Autism Academy, and how each therapy works from referral to discharge.",
};

export default function TherapiesPage() {
  return (
    <>
      <PageIntro
        title="Our therapies"
        intro="Four therapy lines. Many children benefit from more than one, and our therapists plan together so the goals support each other."
      />

      <Container className="pt-12">
        <ul className="grid gap-4 md:grid-cols-2">
          {THERAPIES.map((t) => (
            <li key={t.slug} className="relative flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 md:p-8">
              <span className="grid size-12 place-items-center rounded-xl bg-mist text-harbour">
                <TherapyIcon slug={t.slug} size={28} />
              </span>
              <h2 className="text-2xl font-semibold text-ink">{t.name}</h2>
              <p className="text-ink-soft">{t.intro}</p>
              <div>
                <p className="font-semibold text-ink">Helps with</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft marker:text-harbour">
                  {t.helpsWith.slice(0, 3).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
              <Link
                href={`/therapies/${t.slug}`}
                className="stretched-link mt-auto inline-flex min-h-11 items-center gap-1.5 font-semibold text-harbour underline decoration-2 underline-offset-4"
              >
                How {t.shortName === "ABA" ? "ABA" : t.name.toLowerCase()} works
                <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      <Container className="pt-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div className="lg:sticky lg:top-28">
            <h2 className="text-3xl font-semibold text-ink md:text-4xl">The same clear steps for every therapy</h2>
            <p className="mt-4 max-w-[48ch] text-lg text-ink-soft">
              Each therapy keeps its own methods, but the journey is the same, and every step is recorded the same way,
              so progress is easy to follow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className={btnPrimary}>
                Book a visit
              </Link>
              <Link href="/contact" className={btnSecondary}>
                Ask a question
              </Link>
            </div>
          </div>
          <JourneyBoard />
        </div>
      </Container>
    </>
  );
}
