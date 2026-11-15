import { ArrowRight, PaperPlaneTilt, Phone, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Container } from "@/components/site/container";
import { JourneyBoard } from "@/components/site/journey-board";
import { btnOnDark, btnOutlineOnDark, btnPrimary, btnSecondary, textLink } from "@/components/site/styles";
import { TherapyIcon } from "@/components/site/therapy-icon";
import { THERAPIES } from "@/content/therapies";
import { listPublicTeam } from "@/server/services/staff";

/** Bento cells: deliberate variation in span and surface, one cell per therapy. */
const CELL_STYLE: Record<string, { span: string; surface: string; dark?: boolean }> = {
  "speech-language-pathology": { span: "md:col-span-4", surface: "bg-mist" },
  "occupational-therapy": { span: "md:col-span-2", surface: "bg-marigold-soft" },
  "applied-behavior-analysis": { span: "md:col-span-2", surface: "bg-surface border border-line" },
  physiotherapy: { span: "md:col-span-4", surface: "bg-harbour", dark: true },
};

const FIRST_VISIT = [
  {
    icon: PaperPlaneTilt,
    title: "Send a request",
    text: "Use the booking form to ask for an appointment, a short demo session or an introduction visit.",
  },
  {
    icon: Phone,
    title: "We contact you",
    text: "A member of the clinic team reads every request and calls or emails you to agree a time.",
  },
  {
    icon: UsersThree,
    title: "Your first visit",
    text: "Tell us about sensory needs in advance, so the visit can be planned around your child.",
  },
];

async function TeamNote() {
  const team = await listPublicTeam();
  if (team.length === 0) {
    return (
      <p className="mt-6 text-ink-soft">Therapist profiles are published here once each person&apos;s details are verified.</p>
    );
  }
  return (
    <ul className="mt-6 flex flex-wrap justify-center gap-2">
      {team.slice(0, 6).map((m) => (
        <li key={m.id} className="rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-ink">
          {m.fullName}
          {m.title ? <span className="font-normal text-ink-muted"> · {m.title}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero: copy left, the journey board right. */}
      <section aria-labelledby="hero-title" className="border-b border-line bg-surface">
        <Container className="grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
          <div>
            <p className="font-accent text-base font-medium text-harbour">Autism therapy for children</p>
            <h1 id="hero-title" className="mt-3 text-[2.5rem] font-semibold leading-[1.06] text-ink sm:text-5xl lg:text-[3.6rem]">
              Therapy that fits your child, one clear step at a time
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-soft">
              Speech and language, occupational, ABA and physiotherapy, planned by one team and explained to you at every
              step.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/book" className={btnPrimary}>
                Book a visit
              </Link>
              <Link href="/therapies" className={btnSecondary}>
                Explore therapies
              </Link>
            </div>
          </div>
          <JourneyBoard compactOnMobile />
        </Container>
      </section>

      {/* Therapies bento */}
      <section aria-labelledby="therapies-title">
        <Container className="pt-20">
          <h2 id="therapies-title" className="text-3xl font-semibold text-ink md:text-4xl">
            Four therapies, one plan
          </h2>
          <p className="mt-3 max-w-[58ch] text-lg text-ink-soft">
            Many children benefit from more than one therapy. Our therapists agree one plan, so the goals support each
            other.
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-6">
            {THERAPIES.map((t) => {
              const cell = CELL_STYLE[t.slug]!;
              return (
                <li key={t.slug} className={`relative flex flex-col gap-3 rounded-3xl p-6 md:p-8 ${cell.span} ${cell.surface}`}>
                  <TherapyIcon slug={t.slug} size={36} className={cell.dark ? "text-marigold" : "text-harbour"} />
                  <h3 className={`text-2xl font-semibold ${cell.dark ? "text-surface" : "text-ink"}`}>{t.name}</h3>
                  <p className={`max-w-[52ch] ${cell.dark ? "text-surface/90" : "text-ink-soft"}`}>{t.summary}</p>
                  <Link
                    href={`/therapies/${t.slug}`}
                    className={`stretched-link mt-auto inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4 ${
                      cell.dark ? "text-surface" : "text-harbour"
                    }`}
                  >
                    About {t.shortName === "ABA" ? "ABA" : t.name.toLowerCase()}
                    <ArrowRight size={18} weight="bold" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Before the first visit: three verbs, no boxes */}
      <section aria-labelledby="visit-title">
        <Container className="pt-24">
          <h2 id="visit-title" className="text-3xl font-semibold text-ink md:text-4xl">
            Before your first visit
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {FIRST_VISIT.map((step) => (
              <li key={step.title} className="border-t-2 border-harbour pt-6">
                <step.icon size={30} weight="duotone" className="text-harbour" aria-hidden />
                <h3 className="mt-4 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
          <Link href="/book" className={`${textLink} mt-8`}>
            Go to the booking form
            <ArrowRight size={18} weight="bold" aria-hidden />
          </Link>
        </Container>
      </section>

      {/* Team statement */}
      <section aria-labelledby="team-title">
        <Container className="pt-24">
          <div className="board-dots rounded-3xl px-6 py-14 text-center md:px-16">
            <h2 id="team-title" className="mx-auto max-w-2xl text-3xl font-semibold text-ink md:text-4xl">
              Therapists from four disciplines, planning together
            </h2>
            <p className="mx-auto mt-4 max-w-[56ch] text-lg text-ink-soft">
              Speech, daily skills, behaviour and movement goals are agreed in one plan, so your child is not pulled in
              different directions.
            </p>
            <TeamNote />
            <Link href="/team" className={`${btnSecondary} mt-8`}>
              Meet the team
            </Link>
          </div>
        </Container>
      </section>

      {/* Closing call to action */}
      <section aria-labelledby="cta-title">
        <Container className="pt-24">
          <div className="grid items-center gap-8 rounded-3xl bg-harbour-deep px-6 py-12 md:grid-cols-[1.4fr_1fr] md:px-14">
            <div>
              <h2 id="cta-title" className="text-3xl font-semibold text-surface md:text-4xl">
                Not sure where to start?
              </h2>
              <p className="mt-3 max-w-[48ch] text-lg text-surface/90">
                Book an introduction to meet the team and see the clinic, or a short demo session so your child can try a
                therapy.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/book?type=introduction" className={btnOnDark}>
                Book a visit
              </Link>
              <Link href="/contact" className={btnOutlineOnDark}>
                Ask a question
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
