import { scopeFor, type Action, type Actor, type ResourceType, type Scope } from "./permissions";

/**
 * Clinic app navigation. Items are shown when the actor's read scope for the
 * item's resource meets `minScope`. Hiding an item is a convenience only:
 * every page and service re-checks permissions.
 */

export type NavIconKey =
  | "dashboard"
  | "calendar"
  | "templates"
  | "appointments"
  | "patients"
  | "sessions"
  | "staff"
  | "profile"
  | "attendance"
  | "events"
  | "accounts"
  | "invoices"
  | "payments"
  | "expenses"
  | "blog"
  | "inbox"
  | "about"
  | "users"
  | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
  resource: ResourceType;
  minScope: Exclude<Scope, "none">;
  /** Permission checked for visibility. Defaults to "read". */
  action?: Action;
  /** Set for modules that are not built yet. */
  comingInPhase?: 2 | 3 | 4;
  summary?: string;
};

export type NavGroup = { key: string; label: string; items: NavItem[] };

export const CLINIC_NAV: NavGroup[] = [
  {
    key: "clinic",
    label: "Clinic",
    items: [
      { href: "/app", label: "Dashboard", icon: "dashboard", resource: "dashboard", minScope: "own" },
      { href: "/app/calendar", label: "Calendar", icon: "calendar", resource: "therapySession", minScope: "own" },
      { href: "/app/appointments", label: "Appointments", icon: "appointments", resource: "appointment", minScope: "own" },
      {
        href: "/app/patients",
        label: "Patients",
        icon: "patients",
        resource: "patient",
        minScope: "own",
      },
      {
        href: "/app/sessions",
        label: "Therapy sessions",
        icon: "sessions",
        resource: "therapySession",
        minScope: "own",
      },
      {
        href: "/app/staff",
        label: "Staff",
        icon: "staff",
        resource: "staffProfile",
        minScope: "all",
      },
      {
        href: "/app/my-profile",
        label: "My profile",
        icon: "profile",
        resource: "staffProfile",
        minScope: "own",
      },
      {
        href: "/app/attendance",
        label: "Attendance",
        icon: "attendance",
        resource: "attendance",
        minScope: "own",
      },
      {
        href: "/app/events",
        label: "Events",
        icon: "events",
        resource: "event",
        minScope: "own",
        comingInPhase: 3,
        summary: "Clinic events with agenda, workflow and assigned staff.",
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      { href: "/app/finance/accounts", label: "Accounts", icon: "accounts", resource: "finance", minScope: "all", comingInPhase: 3, summary: "Chart of accounts and balances." },
      { href: "/app/finance/invoices", label: "Invoices", icon: "invoices", resource: "finance", minScope: "all", comingInPhase: 3, summary: "Patient invoices and receipts." },
      { href: "/app/finance/payments", label: "Fee submissions", icon: "payments", resource: "finance", minScope: "all", comingInPhase: 3, summary: "Fee submissions, including payment proof uploaded by parents." },
      { href: "/app/finance/expenses", label: "Bills and expenses", icon: "expenses", resource: "finance", minScope: "all", comingInPhase: 3, summary: "Bills and day-to-day expenses." },
    ],
  },
  {
    key: "content",
    label: "Content",
    items: [
      { href: "/app/inbox", label: "Inbox", icon: "inbox", resource: "message", minScope: "all" },
      { href: "/app/about", label: "About details", icon: "about", resource: "clinicProfile", minScope: "all" },
      { href: "/app/blog", label: "Blog", icon: "blog", resource: "blogPost", minScope: "all", comingInPhase: 3, summary: "Blog posts with categories and search." },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { href: "/app/settings/users", label: "Users and roles", icon: "users", resource: "user", minScope: "all" },
      { href: "/app/settings/templates", label: "Record templates", icon: "templates", resource: "formTemplate", action: "update", minScope: "all" },
      { href: "/app/settings/clinic", label: "Clinic settings", icon: "settings", resource: "settings", minScope: "all", comingInPhase: 3, summary: "Currency and other clinic-wide settings." },
    ],
  },
];

const RANK: Record<Scope, number> = { none: 0, public: 1, own: 2, all: 3 };

export function isNavItemVisible(actor: Actor, item: NavItem): boolean {
  const scope = scopeFor(actor, item.action ?? "read", item.resource);
  if (item.minScope === "own" && item.resource === "staffProfile") {
    // "My profile" is for staff; admins manage everyone under "Staff".
    return scope === "own";
  }
  return RANK[scope] >= RANK[item.minScope];
}

export function navForActor(actor: Actor): NavGroup[] {
  return CLINIC_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavItemVisible(actor, item)),
  })).filter((group) => group.items.length > 0);
}

export function findNavItem(href: string): NavItem | undefined {
  for (const group of CLINIC_NAV) {
    const item = group.items.find((i) => i.href === href);
    if (item) return item;
  }
  return undefined;
}
