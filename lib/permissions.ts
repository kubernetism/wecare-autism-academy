import type { UserRole } from "@/db/schema/enums";

/**
 * The roles-and-permissions matrix from design/system-design.md section 2,
 * expressed as code. Pure and framework-free so it can be unit tested and
 * used by every service function.
 *
 * Two questions are answered here:
 * - `scopeFor(actor, action, type)`: how much of a resource type an actor can
 *   reach ("all", only their "own" records, only "public" ones, or "none").
 *   List queries use it to decide which filter to apply; navigation uses it
 *   to decide what to show.
 * - `can(actor, action, resource)`: may this actor act on this specific
 *   record? It applies the scope plus the ownership facts carried by the
 *   resource. Missing ownership facts never grant access (fail closed).
 *
 * `actor` is null for anonymous visitors of the public website.
 */

export type Action = "read" | "create" | "update" | "delete";

export type Actor = {
  userId: string;
  role: UserRole;
  /** Set for staff and admins who have a staff profile. */
  staffProfileId: string | null;
  /** Set for parents. */
  parentId: string | null;
};

/** Who a patient belongs to: assigned staff and linked parents. */
export type PatientScope = {
  assignedStaffProfileIds: readonly string[];
  parentIds: readonly string[];
};

/** Clinical record kinds a parent may read for their own child. */
const PARENT_VISIBLE_RECORD_KINDS = [
  "status",
  "prescription",
  "report_card",
] as const;

export type ClinicalRecordKind =
  | (typeof PARENT_VISIBLE_RECORD_KINDS)[number]
  | "intake"
  | "assessment"
  | "plan"
  | "goal"
  | "session_note"
  | "progress_review"
  | "discharge";

export type FinanceKind =
  | "invoice"
  | "receipt"
  | "payment"
  | "account"
  | "bill"
  | "expense";

export type Resource =
  | { type: "dashboard" }
  | { type: "patient"; patient: PatientScope }
  | { type: "clinicalRecord"; kind: ClinicalRecordKind; patient: PatientScope }
  /** Admit / re-admit / cancel / upgrade / discharge events. */
  | { type: "admission"; patient: PatientScope }
  /** Which staff are assigned to a patient. */
  | { type: "patientAssignment" }
  /** A patient's course and plan in one therapy line. */
  | { type: "enrollment"; patient: PatientScope }
  /** Scheduling a therapy session (calendar). `staffProfileId` runs the session. */
  | { type: "therapySession"; patient: PatientScope; staffProfileId: string | null }
  /** Writing a session's clinical record (the session wizard). */
  | { type: "sessionRecord"; patient: PatientScope; staffProfileId: string | null }
  | { type: "medicalFile"; patient: PatientScope }
  | { type: "formTemplate" }
  | { type: "ragQuery"; patient: PatientScope }
  | { type: "event"; isPublic: boolean; assignedStaffProfileIds: readonly string[] }
  | { type: "staffProfile"; staffProfileId: string }
  | { type: "user" }
  | { type: "finance"; kind: FinanceKind; parentId: string | null }
  | {
      type: "appointment";
      requestedByUserId: string | null;
      assignedStaffProfileId: string | null;
    }
  | {
      type: "attendance";
      kind: "patient" | "staff";
      /** Patient attendance: the staff running the session. Staff attendance: the staff member. */
      staffProfileId: string | null;
      patient: PatientScope | null;
    }
  | { type: "blogPost"; isPublished: boolean }
  | { type: "clinicProfile" }
  | { type: "message"; senderUserId: string | null }
  | { type: "settings" };

export type ResourceType = Resource["type"];

export type Scope = "all" | "own" | "public" | "none";

type Role = UserRole | "anonymous";
type ScopeTable = Record<ResourceType, Record<Role, Partial<Record<Action, Scope>>>>;

const CRUD_ALL = {
  read: "all",
  create: "all",
  update: "all",
  delete: "all",
} as const satisfies Record<Action, Scope>;

/**
 * The matrix. Anything not listed is "none".
 * Interpretations of the design table (documented so they can be revisited):
 * - Staff never delete. Clinical records are soft-deleted by admins only.
 * - Staff "Read/Add/Edit assigned": read/create/update records of assigned
 *   patients and update the patient file; admitting a new patient is admin.
 * - Parents read their own child's status, prescriptions and report cards.
 * - Appointments: anyone may submit a request (public website); parents
 *   track their own; staff view those assigned to them.
 * - Messages: anyone may send one (contact form); parents read their own.
 */
const MATRIX: ScopeTable = {
  dashboard: {
    admin: { read: "all" },
    staff: { read: "own" },
    parent: { read: "own" },
    anonymous: {},
  },
  patient: {
    admin: CRUD_ALL,
    staff: { read: "own", update: "own" },
    parent: { read: "own" },
    anonymous: {},
  },
  clinicalRecord: {
    admin: CRUD_ALL,
    staff: { read: "own", create: "own", update: "own" },
    parent: { read: "own" },
    anonymous: {},
  },
  admission: {
    admin: CRUD_ALL,
    staff: { read: "own" },
    parent: {},
    anonymous: {},
  },
  patientAssignment: {
    admin: CRUD_ALL,
    staff: {},
    parent: {},
    anonymous: {},
  },
  enrollment: {
    admin: CRUD_ALL,
    staff: { read: "own" },
    parent: {},
    anonymous: {},
  },
  therapySession: {
    admin: CRUD_ALL,
    staff: { read: "own" },
    parent: {},
    anonymous: {},
  },
  sessionRecord: {
    admin: CRUD_ALL,
    staff: { read: "own", create: "own", update: "own" },
    parent: {},
    anonymous: {},
  },
  medicalFile: {
    admin: CRUD_ALL,
    staff: { read: "own", create: "own" },
    parent: {},
    anonymous: {},
  },
  formTemplate: {
    admin: CRUD_ALL,
    staff: { read: "all" },
    parent: {},
    anonymous: {},
  },
  ragQuery: {
    admin: { read: "all", create: "all", update: "all" },
    staff: { read: "own", create: "own", update: "own" },
    parent: {},
    anonymous: {},
  },
  event: {
    admin: CRUD_ALL,
    staff: { read: "own" },
    parent: { read: "public" },
    anonymous: { read: "public" },
  },
  staffProfile: {
    admin: CRUD_ALL,
    staff: { read: "own", update: "own" },
    parent: {},
    anonymous: {},
  },
  user: {
    admin: CRUD_ALL,
    staff: {},
    parent: {},
    anonymous: {},
  },
  finance: {
    admin: CRUD_ALL,
    staff: {},
    // Own invoices/receipts, and uploading payment proof.
    parent: { read: "own", create: "own" },
    anonymous: {},
  },
  appointment: {
    admin: CRUD_ALL,
    staff: { read: "own" },
    parent: { read: "own", create: "all" },
    anonymous: { create: "all" },
  },
  attendance: {
    admin: CRUD_ALL,
    staff: { read: "own", create: "own", update: "own" },
    parent: { read: "own" },
    anonymous: {},
  },
  blogPost: {
    admin: CRUD_ALL,
    staff: {},
    parent: { read: "public" },
    anonymous: { read: "public" },
  },
  clinicProfile: {
    admin: { read: "all", update: "all" },
    staff: {},
    parent: { read: "all" },
    anonymous: { read: "all" },
  },
  message: {
    admin: CRUD_ALL,
    staff: {},
    parent: { read: "own", create: "all" },
    anonymous: { create: "all" },
  },
  settings: {
    admin: { read: "all", update: "all" },
    staff: {},
    parent: {},
    anonymous: {},
  },
};

export function scopeFor(
  actor: Actor | null,
  action: Action,
  type: ResourceType,
): Scope {
  const role: Role = actor?.role ?? "anonymous";
  return MATRIX[type][role][action] ?? "none";
}

function includesId(ids: readonly string[], id: string | null): boolean {
  return id !== null && ids.includes(id);
}

function ownsPatient(actor: Actor, patient: PatientScope): boolean {
  switch (actor.role) {
    case "staff":
      return includesId(patient.assignedStaffProfileIds, actor.staffProfileId);
    case "parent":
      return includesId(patient.parentIds, actor.parentId);
    case "admin":
      return true;
  }
}

/** Ownership test for the "own" scope. Only called with a signed-in actor. */
function owns(actor: Actor, resource: Resource): boolean {
  switch (resource.type) {
    case "dashboard":
      // Every signed-in user has their own dashboard view.
      return true;
    case "patient":
    case "admission":
    case "enrollment":
    case "medicalFile":
    case "ragQuery":
      return ownsPatient(actor, resource.patient);
    case "therapySession":
    case "sessionRecord":
      // Staff work on sessions of patients assigned to them; a session they run
      // also counts (e.g. covering for a colleague).
      return (
        ownsPatient(actor, resource.patient) ||
        (actor.staffProfileId !== null && resource.staffProfileId === actor.staffProfileId)
      );
    case "clinicalRecord":
      if (
        actor.role === "parent" &&
        !(PARENT_VISIBLE_RECORD_KINDS as readonly string[]).includes(resource.kind)
      ) {
        return false;
      }
      return ownsPatient(actor, resource.patient);
    case "event":
      return includesId(resource.assignedStaffProfileIds, actor.staffProfileId);
    case "staffProfile":
      return (
        actor.staffProfileId !== null &&
        resource.staffProfileId === actor.staffProfileId
      );
    case "finance":
      return (
        actor.role === "parent" &&
        (resource.kind === "invoice" ||
          resource.kind === "receipt" ||
          resource.kind === "payment") &&
        actor.parentId !== null &&
        resource.parentId === actor.parentId
      );
    case "appointment":
      if (actor.role === "parent") {
        return resource.requestedByUserId === actor.userId;
      }
      return (
        actor.staffProfileId !== null &&
        resource.assignedStaffProfileId === actor.staffProfileId
      );
    case "attendance":
      if (actor.role === "parent") {
        return (
          resource.kind === "patient" &&
          resource.patient !== null &&
          ownsPatient(actor, resource.patient)
        );
      }
      return (
        actor.staffProfileId !== null &&
        resource.staffProfileId === actor.staffProfileId
      );
    case "message":
      return resource.senderUserId === actor.userId;
    case "user":
    case "patientAssignment":
    case "formTemplate":
    case "blogPost":
    case "clinicProfile":
    case "settings":
      return false;
  }
}

function isPublic(resource: Resource): boolean {
  switch (resource.type) {
    case "event":
      return resource.isPublic;
    case "blogPost":
      return resource.isPublished;
    default:
      return false;
  }
}

export function can(
  actor: Actor | null,
  action: Action,
  resource: Resource,
): boolean {
  const scope = scopeFor(actor, action, resource.type);
  switch (scope) {
    case "all":
      return true;
    case "public":
      return isPublic(resource);
    case "own":
      return actor !== null && owns(actor, resource);
    case "none":
      return false;
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless `can` allows the action. */
export function assertCan(
  actor: Actor | null,
  action: Action,
  resource: Resource,
): void {
  if (!can(actor, action, resource)) throw new ForbiddenError();
}
