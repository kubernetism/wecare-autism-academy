import { Card, Result } from "antd";
import { StaffProfileView } from "@/components/clinic/staff-profile-view";
import { THERAPIES } from "@/content/therapies";
import { scopeFor } from "@/lib/permissions";
import { ymdInZone } from "@/lib/time";
import { env } from "@/server/env";
import { staffMonth } from "@/server/services/attendance";
import { getStaff } from "@/server/services/staff-profiles";
import { requireUser } from "@/server/session";

export const metadata = { title: "My profile" };

export default async function MyProfilePage({ searchParams }: PageProps<"/app/my-profile">) {
  const user = await requireUser(["admin", "staff"], "/app/my-profile");
  if (!user.staffProfileId) {
    return (
      <Card>
        <Result status="info" title="No staff profile" subTitle="Your account is not linked to a staff profile. Administrators manage staff under Staff." />
      </Card>
    );
  }
  const sp = await searchParams;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ymdInZone(new Date(), env.CLINIC_TIME_ZONE).slice(0, 7);
  const [staff, attendance] = await Promise.all([getStaff(user, user.staffProfileId), staffMonth(user, user.staffProfileId, month)]);
  return (
    <StaffProfileView
      staff={staff}
      attendance={attendance}
      month={month}
      isAdmin={scopeFor(user, "update", "staffProfile") === "all"}
      isSelf
      therapies={THERAPIES.map((t) => ({ value: t.slug, label: t.name }))}
      timeZone={env.CLINIC_TIME_ZONE}
    />
  );
}
