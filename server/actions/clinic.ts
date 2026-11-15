"use server";

import { refresh, updateTag } from "next/cache";
import {
  appointmentDecisionSchema,
  clinicProfileSchema,
  createStaffAccountSchema,
  rejectAppointmentSchema,
  scheduleAppointmentSchema,
  setMessageStatusSchema,
} from "@/lib/validation/clinic";
import { transitionAppointment, type AppointmentTransition } from "../services/appointments";
import { CLINIC_PROFILE_TAG, updateClinicProfile } from "../services/clinic-profile";
import { setMessageStatus } from "../services/messages";
import { createStaffAccount, TEAM_TAG } from "../services/staff";
import { runAction } from "./run";

const run = runAction;

function decide(transition: Exclude<AppointmentTransition, "schedule" | "reject">) {
  return (input: unknown) =>
    run(`appointment.${transition}`, appointmentDecisionSchema, input, async (actor, data) => {
      await transitionAppointment(actor, transition, { id: data.id, note: data.note });
      refresh();
      return null;
    });
}

export async function approveAppointment(input: unknown) {
  return decide("approve")(input);
}

export async function cancelAppointment(input: unknown) {
  return decide("cancel")(input);
}

export async function completeAppointment(input: unknown) {
  return decide("complete")(input);
}

export async function rejectAppointment(input: unknown) {
  return run("appointment.reject", rejectAppointmentSchema, input, async (actor, data) => {
    await transitionAppointment(actor, "reject", { id: data.id, note: data.note });
    refresh();
    return null;
  });
}

export async function scheduleAppointment(input: unknown) {
  return run("appointment.schedule", scheduleAppointmentSchema, input, async (actor, data) => {
    const start = new Date(data.start);
    const end = new Date(start.getTime() + data.durationMinutes * 60_000);
    await transitionAppointment(actor, "schedule", {
      id: data.id,
      note: data.note,
      schedule: { start, end, assignedStaffId: data.assignedStaffId },
    });
    refresh();
    return null;
  });
}

export async function updateMessageStatus(input: unknown) {
  return run("message.status", setMessageStatusSchema, input, async (actor, data) => {
    await setMessageStatus(actor, data.id, data.status);
    refresh();
    return null;
  });
}

export async function saveClinicProfile(input: unknown) {
  return run("clinicProfile.update", clinicProfileSchema, input, async (actor, data) => {
    await updateClinicProfile(actor, data);
    updateTag(CLINIC_PROFILE_TAG);
    return null;
  });
}

export async function addStaffAccount(input: unknown) {
  return run("staffAccount.create", createStaffAccountSchema, input, async (actor, data) => {
    const created = await createStaffAccount(actor, data);
    updateTag(TEAM_TAG);
    refresh();
    return created;
  });
}
