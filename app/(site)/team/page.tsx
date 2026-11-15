import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { PageIntro } from "@/components/site/page-intro";
import { btnPrimary } from "@/components/site/styles";
import { TherapyIcon } from "@/components/site/therapy-icon";
import { THERAPIES } from "@/content/therapies";
import { listPublicTeam } from "@/server/services/staff";

export const metadata: Metadata = {
  title: "Our team",
  description: "Meet the verified therapists and doctors at WeCare Autism Academy across our four therapy lines.",
};

export default async function TeamPage() {
  const team = await listPublicTeam();

  return (
    <>
      <PageIntro
        title="Our team"
        intro="Doctors and therapists from four disciplines work together on each child's plan. Every profile shown here has been verified by the clinic."
      />
      <Container className="pt-12">
        {team.length === 0 ? (
          <div className="grid gap-8 rounded-3xl border border-line bg-surface p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
            <div>
              <SealCheck size={40} weight="duotone" className="text-harbour" aria-hidden />
              <h2 className="mt-4 text-2xl font-semibold text-ink">Team profiles are being prepared</h2>
              <p className="mt-3 max-w-[52ch] text-ink-soft">
                Each therapist&apos;s profile is published here once their details have been verified. In the meantime, you
                are welcome to book an introduction to meet the team in person.
              </p>
              <Link href="/book?type=introduction" className={`${btnPrimary} mt-6`}>
                Book a visit
              </Link>
            </div>
            <div>
              <p className="font-semibold text-ink">Our therapy lines</p>
              <ul className="mt-3 flex flex-col gap-2">
                {THERAPIES.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/therapies/${t.slug}`}
                      className="flex min-h-12 items-center gap-3 rounded-xl bg-mist px-4 font-semibold text-ink hover:text-harbour"
                    >
                      <TherapyIcon slug={t.slug} size={22} className="text-harbour" />
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => (
              <li key={m.id} className="rounded-3xl border border-line bg-surface p-6">
                <h2 className="text-xl font-semibold text-ink">{m.fullName}</h2>
                {m.title ? <p className="mt-1 text-ink-soft">{m.title}</p> : null}
                {m.therapyNames.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {m.therapyNames.map((n) => (
                      <li key={n} className="rounded-lg bg-mist px-2 py-0.5 text-sm font-semibold text-ink">
                        {n}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {m.bio ? <p className="mt-3 text-ink-soft">{m.bio}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
