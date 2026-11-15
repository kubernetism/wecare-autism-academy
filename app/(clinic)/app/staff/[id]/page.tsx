import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/clinic/access-denied";
import { StaffProfileView } from "@/components/clinic/staff-profile-view";
import { THERAPIES } from "@/content/therapies";
import { ForbiddenError, scopeFor } from "@/lib/permissions";
import { ymdInZone } from "@/lib/time";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { staffMonth } from "@/server/services/attendance";
import { getStaff } from "@/server/services/staff-profiles";
import { requireUser } from "@/server/session";

export const metadata = { title: "Staff member" };

export default async function StaffMemberPage({ params, searchParams }: PageProps<"/app/staff/[id]">) {
  const user = await requireUser(["admin", "staff"], "/app/staff");
  const { id } = await params;
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ymdInZone(new Date(), env.CLINIC_TIME_ZONE).slice(0, 7);
  let loaded;
  try {
    loaded = await Promise.all([getStaff(user, id), staffMonth(user, id, month)]);
  } catch (error) {
    if (error instanceof ForbiddenError) loaded = null;
    else if (error instanceof NotFoundError) notFound();
    else throw error;
  }
  if (!loaded) return <AccessDenied />;
  const [staff, attendance] = loaded;
  return (
    <StaffProfileView
      staff={staff}
      attendance={attendance}
      month={month}
      isAdmin={scopeFor(user, "update", "staffProfile") === "all"}
      isSelf={user.staffProfileId === id}
      therapies={THERAPIES.map((t) => ({ value: t.slug, label: t.name }))}
      timeZone={env.CLINIC_TIME_ZONE}
    />
  );
}
