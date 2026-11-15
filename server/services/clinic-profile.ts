import "server-only";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { clinicProfile } from "@/db/schema";
import type { BookItem, CourseItem, LearningSourceItem, SessionItem } from "@/db/schema/content";
import { assertCan, type Actor } from "@/lib/permissions";
import type { ClinicProfileData } from "@/lib/validation/clinic";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { isDatabaseConfigured } from "../env";

export const CLINIC_PROFILE_TAG = "clinic-profile";

export type ClinicProfile = {
  registeredName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  offeredCourses: CourseItem[];
  sessions: SessionItem[];
  recommendedBooks: BookItem[];
  learningSources: LearningSourceItem[];
  updatedAt: string | null;
};

/** Shown when no database is configured (local preview, CI builds). */
const PLACEHOLDER_PROFILE: ClinicProfile = {
  registeredName: "WeCare Autism Academy",
  address: null,
  phone: null,
  email: null,
  openingHours: null,
  offeredCourses: [],
  sessions: [],
  recommendedBooks: [],
  learningSources: [],
  updatedAt: null,
};

async function readProfile(): Promise<ClinicProfile> {
  const [row] = await getDb().select().from(clinicProfile).where(eq(clinicProfile.id, 1)).limit(1);
  if (!row) return PLACEHOLDER_PROFILE;
  return {
    registeredName: row.registeredName,
    address: row.address,
    phone: row.phone,
    email: row.email,
    openingHours: row.openingHours,
    offeredCourses: row.offeredCourses,
    sessions: row.sessions,
    recommendedBooks: row.recommendedBooks,
    learningSources: row.learningSources,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Public clinic details for the website. Cached across requests and
 * invalidated by tag when the admin saves the About editor. Public data only.
 */
export const getPublicClinicProfile = unstable_cache(
  async (): Promise<ClinicProfile> => {
    if (!isDatabaseConfigured()) return PLACEHOLDER_PROFILE;
    return readProfile();
  },
  ["public-clinic-profile"],
  { tags: [CLINIC_PROFILE_TAG], revalidate: 3600 },
);

/** Fresh read for the editor. */
export async function getClinicProfileForEdit(actor: Actor): Promise<ClinicProfile> {
  assertCan(actor, "update", { type: "clinicProfile" });
  return readProfile();
}

export async function updateClinicProfile(actor: Actor, input: ClinicProfileData): Promise<void> {
  assertCan(actor, "update", { type: "clinicProfile" });
  const values = {
    registeredName: input.registeredName,
    address: input.address ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    openingHours: input.openingHours ?? null,
    offeredCourses: input.offeredCourses,
    sessions: input.sessions,
    recommendedBooks: input.recommendedBooks,
    learningSources: input.learningSources,
    updatedByUserId: actor.userId,
  };

  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(clinicProfile)
      .where(eq(clinicProfile.id, 1))
      .for("update")
      .limit(1);

    await tx
      .insert(clinicProfile)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: clinicProfile.id, set: values });

    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "clinic_profile.update",
      entityType: "clinic_profile",
      entityId: "1",
      before: before ?? null,
      after: values,
    });
  });
}
