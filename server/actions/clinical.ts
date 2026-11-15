"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/result";
import { uuidSchema } from "@/lib/validation/common";
import {
  admitPatientSchema,
  amendSessionSchema,
  amendStageRecordSchema,
  assignStaffSchema,
  cancelPatientSchema,
  cancelSessionSchema,
  createStageRecordSchema,
  enrollSchema,
  goalSchema,
  goalStatusSchema,
  patientAttendanceSchema,
  readmitPatientSchema,
  rescheduleSessionSchema,
  saveSessionStepSchema,
  saveStageRecordSchema,
  scheduleSessionSchema,
  setStaffActiveSchema,
  signOffSessionSchema,
  staffAttendanceSchema,
  staffProfileSchema,
  updatePatientSchema,
  updateStaffSchema,
  upgradeSchema,
} from "@/lib/validation/clinical";
import { markPatientAttendance, markStaffAttendance, selfCheck } from "../services/attendance";
import { amendStageRecord, createStageRecord, saveStageRecord } from "../services/clinical-records";
import { addGoal, deleteGoal, enroll, setGoalStatus, upgradeEnrollment } from "../services/enrollments";
import { deleteFile } from "../services/files";
import { admitPatient, assignStaff, cancelPatient, readmitPatient, unassignStaff, updatePatient } from "../services/patients";
import { amendSession, cancelSession, rescheduleSession, saveSessionStep, scheduleSessions, signOffSession, type SignOffResult } from "../services/sessions";
import { TEAM_TAG } from "../services/staff";
import { createStaff, setStaffActive, updateStaff } from "../services/staff-profiles";
import { runAction, withFieldErrors } from "./run";

const idSchema = z.object({ id: uuidSchema });

/* ---------- Patients ---------- */

export async function admitPatientAction(input: unknown) {
  return runAction("patient.admit", admitPatientSchema, input, async (actor, data) => {
    const created = await admitPatient(actor, data);
    refresh();
    return created;
  });
}

export async function updatePatientAction(input: unknown) {
  return runAction("patient.update", updatePatientSchema, input, async (actor, data) => {
    await updatePatient(actor, data);
    refresh();
    return null;
  });
}

export async function cancelPatientAction(input: unknown) {
  return runAction("patient.cancel", cancelPatientSchema, input, async (actor, data) => {
    await cancelPatient(actor, data);
    refresh();
    return null;
  });
}

export async function readmitPatientAction(input: unknown) {
  return runAction("patient.readmit", readmitPatientSchema, input, async (actor, data) => {
    await readmitPatient(actor, data);
    refresh();
    return null;
  });
}

export async function assignStaffAction(input: unknown) {
  return runAction("patient.assign", assignStaffSchema, input, async (actor, data) => {
    await assignStaff(actor, data.patientId, data.staffProfileId);
    refresh();
    return null;
  });
}

export async function unassignStaffAction(input: unknown) {
  return runAction("patient.unassign", assignStaffSchema, input, async (actor, data) => {
    await unassignStaff(actor, data.patientId, data.staffProfileId);
    refresh();
    return null;
  });
}

/* ---------- Enrollments and goals ---------- */

export async function enrollAction(input: unknown) {
  return runAction("enrollment.create", enrollSchema, input, async (actor, data) => {
    const created = await enroll(actor, data);
    refresh();
    return created;
  });
}

export async function upgradeEnrollmentAction(input: unknown) {
  return runAction("enrollment.upgrade", upgradeSchema, input, async (actor, data) => {
    await upgradeEnrollment(actor, data);
    refresh();
    return null;
  });
}

export async function addGoalAction(input: unknown) {
  return runAction("goal.create", goalSchema, input, async (actor, data) => {
    await addGoal(actor, data);
    refresh();
    return null;
  });
}

export async function setGoalStatusAction(input: unknown) {
  return runAction("goal.status", goalStatusSchema, input, async (actor, data) => {
    await setGoalStatus(actor, data);
    refresh();
    return null;
  });
}

export async function deleteGoalAction(input: unknown) {
  return runAction("goal.delete", idSchema, input, async (actor, data) => {
    await deleteGoal(actor, data.id);
    refresh();
    return null;
  });
}

/* ---------- Sessions ---------- */

export async function scheduleSessionsAction(input: unknown) {
  return runAction("session.schedule", scheduleSessionSchema, input, async (actor, data) => {
    const created = await scheduleSessions(actor, data);
    refresh();
    return created;
  });
}

export async function rescheduleSessionAction(input: unknown) {
  return runAction("session.reschedule", rescheduleSessionSchema, input, async (actor, data) => {
    await rescheduleSession(actor, data);
    refresh();
    return null;
  });
}

export async function cancelSessionAction(input: unknown) {
  return runAction("session.cancel", cancelSessionSchema, input, async (actor, data) => {
    await cancelSession(actor, data);
    refresh();
    return null;
  });
}

export async function saveSessionStepAction(input: unknown): Promise<ActionResult<null>> {
  return withFieldErrors(
    await runAction("session.save_step", saveSessionStepSchema, input, async (actor, data) => {
      const result = await saveSessionStep(actor, data);
      refresh();
      return result;
    }),
  );
}

export async function signOffSessionAction(input: unknown): Promise<ActionResult<SignOffResult>> {
  return runAction("session.sign", signOffSessionSchema, input, async (actor, data) => {
    const result = await signOffSession(actor, data);
    if (!result.stepErrors) refresh();
    return result;
  });
}

export async function amendSessionAction(input: unknown): Promise<ActionResult<SignOffResult>> {
  return runAction("session.amend", amendSessionSchema, input, async (actor, data) => {
    const result = await amendSession(actor, data);
    if (!result.stepErrors) refresh();
    return result;
  });
}

/* ---------- Stage records ---------- */

export async function createStageRecordAction(input: unknown) {
  return runAction("clinical_record.create", createStageRecordSchema, input, async (actor, data) => {
    const created = await createStageRecord(actor, data);
    refresh();
    return created;
  });
}

export async function saveStageRecordAction(input: unknown): Promise<ActionResult<null>> {
  return withFieldErrors(await runAction("clinical_record.save", saveStageRecordSchema, input, (actor, data) => saveStageRecord(actor, data, false)));
}

export async function signStageRecordAction(input: unknown): Promise<ActionResult<null>> {
  const result = withFieldErrors(await runAction("clinical_record.sign", saveStageRecordSchema, input, (actor, data) => saveStageRecord(actor, data, true)));
  if (result.ok) refresh();
  return result;
}

export async function amendStageRecordAction(input: unknown): Promise<ActionResult<null>> {
  const result = withFieldErrors(await runAction("clinical_record.amend", amendStageRecordSchema, input, (actor, data) => amendStageRecord(actor, data)));
  if (result.ok) refresh();
  return result;
}

/* ---------- Files ---------- */

export async function deleteFileAction(input: unknown) {
  return runAction("medical_file.delete", idSchema, input, async (actor, data) => {
    await deleteFile(actor, data.id);
    refresh();
    return null;
  });
}

/* ---------- Attendance ---------- */

export async function markPatientAttendanceAction(input: unknown) {
  return runAction("attendance.patient", patientAttendanceSchema, input, async (actor, data) => {
    await markPatientAttendance(actor, data);
    refresh();
    return null;
  });
}

export async function markStaffAttendanceAction(input: unknown) {
  return runAction("attendance.staff", staffAttendanceSchema, input, async (actor, data) => {
    await markStaffAttendance(actor, data);
    refresh();
    return null;
  });
}

export async function selfCheckAction(input: unknown) {
  return runAction("attendance.self", z.object({ direction: z.enum(["in", "out"]) }), input, async (actor, data) => {
    await selfCheck(actor, data.direction);
    refresh();
    return null;
  });
}

/* ---------- Staff ---------- */

export async function createStaffAction(input: unknown) {
  return runAction("staff.create", staffProfileSchema, input, async (actor, data) => {
    const created = await createStaff(actor, data);
    updateTag(TEAM_TAG);
    refresh();
    return created;
  });
}

export async function updateStaffAction(input: unknown) {
  return runAction("staff.update", updateStaffSchema, input, async (actor, data) => {
    await updateStaff(actor, data);
    updateTag(TEAM_TAG);
    refresh();
    return null;
  });
}

export async function setStaffActiveAction(input: unknown) {
  return runAction("staff.active", setStaffActiveSchema, input, async (actor, data) => {
    await setStaffActive(actor, data);
    updateTag(TEAM_TAG);
    refresh();
    return null;
  });
}
