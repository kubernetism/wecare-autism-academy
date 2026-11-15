import { PaperPlaneTilt, Phone, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingForm, BookingFormWithParams } from "@/components/site/booking-form";
import { Container } from "@/components/site/container";
import { PageIntro } from "@/components/site/page-intro";

export const metadata: Metadata = {
  title: "Book a visit",
  description: "Request an appointment, a demo session or an introduction visit at WeCare Autism Academy.",
};

const NEXT_STEPS = [
  { icon: PaperPlaneTilt, title: "We review your request", text: "A member of the clinic team reads every request." },
  { icon: Phone, title: "We contact you", text: "We call or email to agree a date and time that suits your child." },
  { icon: UsersThree, title: "You visit", text: "Tell us about any sensory needs so we can plan the visit around your child." },
];

export default function BookPage() {
  return (
    <>
      <PageIntro
        title="Book a visit"
        intro="Tell us a little about your child and what you are looking for. This is a request, not a confirmed booking: the clinic will contact you to agree a time."
      />
      <Container className="pt-12">
        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section aria-label="Booking form" className="rounded-3xl border border-line bg-surface p-6 md:p-8">
            {/* The static HTML has the full form; the client then applies ?therapy= / ?type= presets. */}
            <Suspense fallback={<BookingForm />}>
              <BookingFormWithParams />
            </Suspense>
          </section>
          <aside aria-labelledby="next-title" className="board-dots rounded-3xl p-6 md:p-8 lg:sticky lg:top-28">
            <h2 id="next-title" className="text-2xl font-semibold text-ink">
              What happens next
            </h2>
            <ol className="mt-5 flex flex-col gap-2.5">
              {NEXT_STEPS.map((s) => (
                <li key={s.title} className="flex gap-4 rounded-2xl bg-surface p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mist text-harbour">
                    <s.icon size={22} weight="duotone" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{s.title}</span>
                    <span className="block text-sm text-ink-soft">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </Container>
    </>
  );
}
