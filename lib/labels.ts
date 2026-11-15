import type {
  AdmissionKind,
  AppointmentStatus,
  AppointmentType,
  EnrollmentStatus,
  GoalStatus,
  LifecycleStage,
  MessageStatus,
  PatientAttendance,
  PatientStatus,
  PreferredTime,
  RecordStatus,
  SessionOutcome,
  SessionStatus,
  Sex,
  StaffAttendance,
  StaffType,
} from "@/db/schema/enums";

/** Human-readable labels shared by the website and the clinic app. */

export const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  appointment: "Appointment",
  demo_session: "Demo session",
  introduction: "Introduction",
};

export const APPOINTMENT_TYPE_HELP: Record<AppointmentType, string> = {
  appointment: "A consultation with a therapist about your child's needs.",
  demo_session: "A short trial session so your child can try a therapy in a calm setting.",
  introduction: "A visit to meet the team, see the clinic and ask questions.",
};

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  scheduled: "Scheduled",
  rejected: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** antd Tag status colours (never preset hue names). */
export const APPOINTMENT_STATUS_TAG: Record<AppointmentStatus, "default" | "processing" | "success" | "warning" | "error"> = {
  pending: "warning",
  approved: "processing",
  scheduled: "success",
  rejected: "error",
  cancelled: "default",
  completed: "default",
};

export const PREFERRED_TIME_LABEL: Record<PreferredTime, string> = {
  any: "Any time",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  new: "New",
  read: "Read",
  archived: "Archived",
};

/* ---------- Phase 2 ---------- */



type TagStatus = "default" | "processing" | "success" | "warning" | "error";

export const SEX_LABEL: Record<Sex, string> = { female: "Female", male: "Male", other: "Other", not_stated: "Not stated" };

export const PATIENT_STATUS_LABEL: Record<PatientStatus, string> = { active: "Active", cancelled: "Cancelled", discharged: "Discharged" };
export const PATIENT_STATUS_TAG: Record<PatientStatus, TagStatus> = { active: "success", cancelled: "error", discharged: "default" };

export const ADMISSION_KIND_LABEL: Record<AdmissionKind, string> = {
  admit: "Admitted",
  readmit: "Re-admitted",
  cancel: "Cancelled",
  upgrade: "Plan changed (upgrade)",
  discharge: "Discharged",
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  discharged: "Discharged",
  cancelled: "Cancelled",
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  achieved: "Achieved",
  discontinued: "Discontinued",
};
export const GOAL_STATUS_TAG: Record<GoalStatus, TagStatus> = { not_started: "default", in_progress: "processing", achieved: "success", discontinued: "warning" };

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = { scheduled: "Scheduled", completed: "Completed", missed: "Missed", cancelled: "Cancelled" };
export const SESSION_STATUS_TAG: Record<SessionStatus, TagStatus> = { scheduled: "processing", completed: "success", missed: "warning", cancelled: "default" };

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = { empty: "Not started", draft: "Draft", signed: "Signed" };
export const RECORD_STATUS_TAG: Record<RecordStatus, TagStatus> = { empty: "default", draft: "warning", signed: "success" };

export const OUTCOME_LABEL: Record<SessionOutcome, string> = { progressing: "Progressing", maintained: "Maintained", regressed: "Regressed", not_assessed: "Not assessed" };

export const PATIENT_ATTENDANCE_LABEL: Record<PatientAttendance, string> = { present: "Present", absent: "Absent", cancelled: "Cancelled" };
export const STAFF_ATTENDANCE_LABEL: Record<StaffAttendance, string> = { present: "Present", absent: "Absent", leave: "Leave" };
export const STAFF_ATTENDANCE_TAG: Record<StaffAttendance, TagStatus> = { present: "success", absent: "error", leave: "warning" };

export const STAFF_TYPE_LABEL: Record<StaffType, string> = { doctor: "Doctor", specialist: "Specialist", labour: "Support staff" };

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  intake: "History and symptoms",
  assessment: "Assessment",
  plan: "Treatment plan and goals",
  session_note: "Session note",
  progress_review: "Progress review",
  discharge: "Discharge",
};
