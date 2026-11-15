import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/site/container";
import { PageIntro } from "@/components/site/page-intro";
import { btnPrimary, btnSecondary } from "@/components/site/styles";
import { ValueOrPlaceholder } from "@/components/site/to-be-confirmed";
import { getPublicClinicProfile } from "@/server/services/clinic-profile";

export const metadata: Metadata = {
  title: "About us",
  description: "About WeCare Autism Academy: our courses, sessions, recommended books and learning sources for families.",
};

function Section({ title, empty, tone, children }: { title: string; empty: boolean; tone: string; children: ReactNode }) {
  return (
    <section className={`rounded-3xl p-6 md:p-8 ${tone}`}>
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      {empty ? <p className="mt-3 text-ink-muted">Details will be added soon.</p> : <div className="mt-4">{children}</div>}
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1 font-semibold text-harbour underline decoration-2 underline-offset-4"
    >
      {children}
      <ArrowUpRight size={16} weight="bold" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const tapLink = "inline-flex min-h-11 items-center font-semibold text-harbour underline decoration-2 underline-offset-4";

export default async function AboutPage() {
  const profile = await getPublicClinicProfile();

  return (
    <>
      <PageIntro
        title={`About ${profile.registeredName}`}
        intro="Speech and language, occupational, ABA and physiotherapy for autistic children, with one coordinated team and a clear, structured record of every step."
      />

      <Container className="pt-12">
        <section aria-labelledby="details-title" className="rounded-3xl border border-line bg-surface p-6 md:p-8">
          <h2 id="details-title" className="text-2xl font-semibold text-ink">
            Clinic details
          </h2>
          <dl className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-ink-muted">Registered name</dt>
              <dd className="mt-1 text-ink">{profile.registeredName}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink-muted">Opening hours</dt>
              <dd className="mt-1 text-ink">
                <ValueOrPlaceholder value={profile.openingHours} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink-muted">Phone</dt>
              <dd className="mt-1">
                <ValueOrPlaceholder value={profile.phone}>
                  <a href={`tel:${(profile.phone ?? "").replace(/[^+0-9]/g, "")}`} className={tapLink}>
                    {profile.phone}
                  </a>
                </ValueOrPlaceholder>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-ink-muted">Email</dt>
              <dd className="mt-1">
                <ValueOrPlaceholder value={profile.email}>
                  <a href={`mailto:${profile.email}`} className={`${tapLink} break-all`}>
                    {profile.email}
                  </a>
                </ValueOrPlaceholder>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold text-ink-muted">Address</dt>
              <dd className="mt-1 whitespace-pre-line text-ink">
                <ValueOrPlaceholder value={profile.address} />
              </dd>
            </div>
          </dl>
        </section>
      </Container>

      <Container className="pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Courses we offer" tone="bg-mist" empty={profile.offeredCourses.length === 0}>
            <ul className="space-y-4">
              {profile.offeredCourses.map((c, i) => (
                <li key={`${c.title}-${i}`}>
                  <p className="font-semibold text-ink">{c.title}</p>
                  {c.description ? <p className="text-ink-soft">{c.description}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Sessions" tone="bg-marigold-soft" empty={profile.sessions.length === 0}>
            <ul className="space-y-4">
              {profile.sessions.map((s, i) => (
                <li key={`${s.title}-${i}`}>
                  <p className="font-semibold text-ink">
                    {s.title}
                    {s.duration ? <span className="font-normal text-ink-soft"> · {s.duration}</span> : null}
                  </p>
                  {s.description ? <p className="text-ink-soft">{s.description}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Recommended books" tone="bg-surface border border-line" empty={profile.recommendedBooks.length === 0}>
            <ul className="space-y-4">
              {profile.recommendedBooks.map((b, i) => (
                <li key={`${b.title}-${i}`}>
                  {b.url ? <ExternalLink href={b.url}>{b.title}</ExternalLink> : <p className="font-semibold text-ink">{b.title}</p>}
                  {b.author ? <p className="text-ink-soft">by {b.author}</p> : null}
                  {b.note ? <p className="text-ink-soft">{b.note}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Learning sources" tone="bg-surface border border-line" empty={profile.learningSources.length === 0}>
            <ul className="space-y-4">
              {profile.learningSources.map((s, i) => (
                <li key={`${s.title}-${i}`}>
                  {s.url ? <ExternalLink href={s.url}>{s.title}</ExternalLink> : <p className="font-semibold text-ink">{s.title}</p>}
                  {s.note ? <p className="text-ink-soft">{s.note}</p> : null}
                </li>
              ))}
            </ul>
          </Section>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/book" className={btnPrimary}>
            Book a visit
          </Link>
          <Link href="/contact" className={btnSecondary}>
            Ask a question
          </Link>
        </div>
      </Container>
    </>
  );
}
