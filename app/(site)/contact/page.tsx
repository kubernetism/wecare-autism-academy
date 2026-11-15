import { Clock, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ContactForm } from "@/components/site/contact-form";
import { Container } from "@/components/site/container";
import { PageIntro } from "@/components/site/page-intro";
import { ValueOrPlaceholder } from "@/components/site/to-be-confirmed";
import { getPublicClinicProfile } from "@/server/services/clinic-profile";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send WeCare Autism Academy a message, or find our phone number, email and address.",
};

const tapLink = "inline-flex min-h-11 items-center font-semibold text-harbour underline decoration-2 underline-offset-4";

export default async function ContactPage() {
  const profile = await getPublicClinicProfile();
  const rows = [
    {
      icon: Phone,
      label: "Phone",
      value: (
        <ValueOrPlaceholder value={profile.phone}>
          <a href={`tel:${(profile.phone ?? "").replace(/[^+0-9]/g, "")}`} className={tapLink}>
            {profile.phone}
          </a>
        </ValueOrPlaceholder>
      ),
    },
    {
      icon: EnvelopeSimple,
      label: "Email",
      value: (
        <ValueOrPlaceholder value={profile.email}>
          <a href={`mailto:${profile.email}`} className={`${tapLink} break-all`}>
            {profile.email}
          </a>
        </ValueOrPlaceholder>
      ),
    },
    { icon: MapPin, label: "Address", value: <span className="whitespace-pre-line"><ValueOrPlaceholder value={profile.address} /></span> },
    { icon: Clock, label: "Opening hours", value: <ValueOrPlaceholder value={profile.openingHours} /> },
  ];

  return (
    <>
      <PageIntro
        title="Contact us"
        intro="Ask us anything about therapies, visits or fees. To book a visit directly, use the booking page."
      />
      <Container className="pt-12">
        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="form-title" className="rounded-3xl border border-line bg-surface p-6 md:p-8">
            <h2 id="form-title" className="mb-6 text-2xl font-semibold text-ink">
              Send a message
            </h2>
            <ContactForm />
          </section>
          <aside aria-labelledby="details-title" className="rounded-3xl bg-mist p-6 md:p-8">
            <h2 id="details-title" className="text-2xl font-semibold text-ink">
              Clinic details
            </h2>
            <dl className="mt-5 space-y-5">
              {rows.map((r) => (
                <div key={r.label} className="flex gap-4">
                  <r.icon size={24} weight="duotone" className="mt-1 shrink-0 text-harbour" aria-hidden />
                  <div>
                    <dt className="text-sm font-semibold text-ink-soft">{r.label}</dt>
                    <dd className="mt-0.5 text-ink">{r.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </Container>
    </>
  );
}
