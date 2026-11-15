import { Check } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/site/container";
import { JourneyBoard } from "@/components/site/journey-board";
import { PageIntro } from "@/components/site/page-intro";
import { btnPrimary } from "@/components/site/styles";
import { TherapyIcon } from "@/components/site/therapy-icon";
import { getTherapyContent, THERAPIES } from "@/content/therapies";

export function generateStaticParams() {
  return THERAPIES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/therapies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const therapy = getTherapyContent(slug);
  if (!therapy) return {};
  return { title: therapy.name, description: therapy.summary };
}

export default async function TherapyPage({ params }: PageProps<"/therapies/[slug]">) {
  const { slug } = await params;
  const therapy = getTherapyContent(slug);
  if (!therapy) notFound();
  const others = THERAPIES.filter((t) => t.slug !== therapy.slug);
  const shortLabel = therapy.shortName === "ABA" ? "ABA" : therapy.name.toLowerCase();

  return (
    <>
      <PageIntro title={therapy.name} intro={therapy.intro} crumbs={[{ href: "/therapies", label: "Therapies" }]} />

      <Container className="pt-12">
        <div className="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className="sr-only">
              How it works, step by step
            </h2>
            <JourneyBoard notes={therapy.stageNotes} title="How it works, step by step" subtitle={therapy.name} />
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
            <div className="rounded-3xl border border-line bg-surface p-6">
              <h2 className="text-xl font-semibold text-ink">Helps with</h2>
              <ul className="mt-4 space-y-3">
                {therapy.helpsWith.map((h) => (
                  <li key={h} className="flex gap-3 text-ink-soft">
                    <Check size={20} weight="bold" className="mt-0.5 shrink-0 text-harbour" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-marigold-soft p-6">
              <h2 className="text-xl font-semibold text-ink">Talk to us about {shortLabel}</h2>
              <p className="mt-2 text-ink-soft">Book an appointment, a short demo session or an introduction visit.</p>
              <Link href={`/book?therapy=${therapy.slug}`} className={`${btnPrimary} mt-5 w-full`}>
                Book a visit
              </Link>
            </div>
          </aside>
        </div>
      </Container>

      <Container className="pt-16">
        <h2 className="text-2xl font-semibold text-ink">Other therapies</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/therapies/${t.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold text-ink hover:border-harbour hover:text-harbour"
              >
                <TherapyIcon slug={t.slug} size={20} className="text-harbour" />
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
