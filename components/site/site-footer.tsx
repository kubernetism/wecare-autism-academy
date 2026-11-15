import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { THERAPIES } from "@/content/therapies";
import { getPublicClinicProfile } from "@/server/services/clinic-profile";
import { ValueOrPlaceholder } from "./to-be-confirmed";

const CLINIC_LINKS = [
  { href: "/team", label: "Our team" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
  { href: "/book", label: "Book a visit" },
  { href: "/login", label: "Log in" },
];

const linkClass = "inline-flex min-h-11 items-center text-ink-soft hover:text-harbour";

export async function SiteFooter() {
  const profile = await getPublicClinicProfile();
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-ink-soft">
            Speech and language, occupational, ABA and physiotherapy, planned around each child by one coordinated team.
          </p>
        </div>
        <nav aria-labelledby="footer-therapies">
          <h2 id="footer-therapies" className="text-base font-semibold text-ink">
            Therapies
          </h2>
          <ul className="mt-2">
            {THERAPIES.map((t) => (
              <li key={t.slug}>
                <Link href={`/therapies/${t.slug}`} className={linkClass}>
                  {t.shortName}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-clinic">
          <h2 id="footer-clinic" className="text-base font-semibold text-ink">
            Clinic
          </h2>
          <ul className="mt-2">
            {CLINIC_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-base font-semibold text-ink">Get in touch</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
            <dt className="text-ink-muted">Phone</dt>
            <dd>
              <ValueOrPlaceholder value={profile.phone}>
                <a href={`tel:${(profile.phone ?? "").replace(/[^+0-9]/g, "")}`} className={linkClass}>
                  {profile.phone}
                </a>
              </ValueOrPlaceholder>
            </dd>
            <dt className="text-ink-muted">Email</dt>
            <dd>
              <ValueOrPlaceholder value={profile.email}>
                <a href={`mailto:${profile.email}`} className={`${linkClass} break-all`}>
                  {profile.email}
                </a>
              </ValueOrPlaceholder>
            </dd>
            <dt className="text-ink-muted">Address</dt>
            <dd className="py-2">
              <ValueOrPlaceholder value={profile.address} />
            </dd>
          </dl>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-sm text-ink-muted sm:px-6">
          <span>© {profile.registeredName}</span>
          <span>Parents and clinic staff use the same log in page.</span>
        </div>
      </div>
    </footer>
  );
}
