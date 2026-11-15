import { describe, expect, it } from "vitest";
import { navForActor } from "./clinic-nav";
import type { Actor } from "./permissions";

const hrefs = (actor: Actor) => navForActor(actor).flatMap((g) => g.items.map((i) => i.href));

describe("clinic navigation", () => {
  it("shows every module to the admin, except the staff-only profile link", () => {
    const admin: Actor = { userId: "a", role: "admin", staffProfileId: null, parentId: null };
    const links = hrefs(admin);
    expect(links).toContain("/app/finance/invoices");
    expect(links).toContain("/app/inbox");
    expect(links).toContain("/app/about");
    expect(links).toContain("/app/settings/users");
    expect(links).toContain("/app/staff");
    expect(links).toContain("/app/calendar");
    expect(links).toContain("/app/settings/templates");
    expect(links).not.toContain("/app/my-profile");
  });

  it("hides finance, content and settings from staff", () => {
    const staff: Actor = { userId: "s", role: "staff", staffProfileId: "sp", parentId: null };
    const links = hrefs(staff);
    expect(links).toEqual(
      expect.arrayContaining(["/app", "/app/calendar", "/app/appointments", "/app/patients", "/app/sessions", "/app/attendance", "/app/my-profile"]),
    );
    for (const hidden of ["/app/finance/invoices", "/app/inbox", "/app/about", "/app/settings/users", "/app/staff", "/app/blog", "/app/settings/templates"]) {
      expect(links).not.toContain(hidden);
    }
    expect(navForActor(staff).map((g) => g.key)).toEqual(["clinic"]);
  });
});
