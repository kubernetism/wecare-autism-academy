import "server-only";
import { and, eq, gt, isNull, lt, ne, notInArray, sql } from "drizzle-orm";
import type { Transaction } from "@/db/create-db";
import { appointments, patients, staffProfiles, therapySessions } from "@/db/schema";
import { formatDateTime } from "@/lib/time";
import { env } from "../env";
import { ConflictError } from "../errors";

type Slot = {
  staffProfileId: string | null;
  patientId?: string | null;
  start: Date;
  end: Date;
  /** Ignore the record being rescheduled. */
  excludeSessionId?: string;
  excludeAppointmentId?: string;
};

/**
 * Rejects double-booking of a therapist (across therapy sessions and scheduled
 * appointments) or a patient (across therapy sessions). Must run inside the
 * transaction that writes the booking: transaction-scoped advisory locks on
 * the therapist and patient serialise concurrent bookings, so two requests
 * cannot both pass the check.
 */
export async function assertSlotFree(tx: Transaction, slot: Slot): Promise<void> {
  const keys = [slot.staffProfileId && `staff:${slot.staffProfileId}`, slot.patientId && `patient:${slot.patientId}`]
    .filter((k): k is string => Boolean(k))
    .sort(); // fixed order avoids lock-order deadlocks
  for (const key of keys) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  }
  const tz = env.CLINIC_TIME_ZONE;

  if (slot.staffProfileId) {
    const [session] = await tx
      .select({ start: therapySessions.scheduledStart, name: staffProfiles.fullName })
      .from(therapySessions)
      .innerJoin(staffProfiles, eq(staffProfiles.id, therapySessions.staffProfileId))
      .where(
        and(
          eq(therapySessions.staffProfileId, slot.staffProfileId),
          isNull(therapySessions.deletedAt),
          notInArray(therapySessions.status, ["cancelled"]),
          lt(therapySessions.scheduledStart, slot.end),
          gt(therapySessions.scheduledEnd, slot.start),
          slot.excludeSessionId ? ne(therapySessions.id, slot.excludeSessionId) : undefined,
        ),
      )
      .limit(1);
    if (session) {
      throw new ConflictError(
        `${session.name} already has a session at ${formatDateTime(session.start.toISOString(), tz)}. Choose another time or therapist.`,
      );
    }
    const [appointment] = await tx
      .select({ start: appointments.scheduledStart })
      .from(appointments)
      .where(
        and(
          eq(appointments.assignedStaffId, slot.staffProfileId),
          eq(appointments.status, "scheduled"),
          lt(appointments.scheduledStart, slot.end),
          sql`coalesce(${appointments.scheduledEnd}, ${appointments.scheduledStart} + interval '1 hour') > ${slot.start}`,
          slot.excludeAppointmentId ? ne(appointments.id, slot.excludeAppointmentId) : undefined,
        ),
      )
      .limit(1);
    if (appointment?.start) {
      throw new ConflictError(
        `This therapist already has an appointment at ${formatDateTime(appointment.start.toISOString(), tz)}. Choose another time or therapist.`,
      );
    }
  }

  if (slot.patientId) {
    const [clash] = await tx
      .select({ start: therapySessions.scheduledStart, first: patients.firstName })
      .from(therapySessions)
      .innerJoin(patients, eq(patients.id, therapySessions.patientId))
      .where(
        and(
          eq(therapySessions.patientId, slot.patientId),
          isNull(therapySessions.deletedAt),
          notInArray(therapySessions.status, ["cancelled"]),
          lt(therapySessions.scheduledStart, slot.end),
          gt(therapySessions.scheduledEnd, slot.start),
          slot.excludeSessionId ? ne(therapySessions.id, slot.excludeSessionId) : undefined,
        ),
      )
      .limit(1);
    if (clash) {
      throw new ConflictError(
        `${clash.first} already has a session at ${formatDateTime(clash.start.toISOString(), tz)}. Choose another time.`,
      );
    }
  }
}
