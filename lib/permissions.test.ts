import { describe, expect, it } from "vitest";
import {
  assertCan,
  can,
  ForbiddenError,
  scopeFor,
  type Action,
  type Actor,
  type PatientScope,
  type Resource,
  type ResourceType,
} from "./permissions";

const admin: Actor = {
  userId: "u-admin",
  role: "admin",
  staffProfileId: "sp-admin",
  parentId: null,
};
const doctor: Actor = {
  userId: "u-doc",
  role: "staff",
  staffProfileId: "sp-doc",
  parentId: null,
};
const otherDoctor: Actor = {
  userId: "u-doc2",
  role: "staff",
  staffProfileId: "sp-doc2",
  parentId: null,
};
/** A staff login whose staff profile is missing must never match "own". */
const staffWithoutProfile: Actor = {
  userId: "u-doc3",
  role: "staff",
  staffProfileId: null,
  parentId: null,
};
const parent: Actor = {
  userId: "u-parent",
  role: "parent",
  staffProfileId: null,
  parentId: "p-1",
};
const otherParent: Actor = {
  userId: "u-parent2",
  role: "parent",
  staffProfileId: null,
  parentId: "p-2",
};

const assignedChild: PatientScope = {
  assignedStaffProfileIds: ["sp-doc"],
  parentIds: ["p-1"],
};

const ACTIONS: Action[] = ["read", "create", "update", "delete"];

describe("admin", () => {
  it("sees the full clinic dashboard", () => {
    expect(scopeFor(admin, "read", "dashboard")).toBe("all");
    expect(can(admin, "read", { type: "dashboard" })).toBe(true);
  });

  const everyResource: Resource[] = [
    { type: "patient", patient: assignedChild },
    { type: "clinicalRecord", kind: "assessment", patient: assignedChild },
    { type: "therapySession", patient: assignedChild, staffProfileId: "sp-doc" },
    { type: "sessionRecord", patient: assignedChild, staffProfileId: "sp-doc" },
    { type: "admission", patient: assignedChild },
    { type: "enrollment", patient: assignedChild },
    { type: "medicalFile", patient: assignedChild },
    { type: "patientAssignment" },
    { type: "formTemplate" },
    { type: "event", isPublic: false, assignedStaffProfileIds: [] },
    { type: "staffProfile", staffProfileId: "sp-doc" },
    { type: "user" },
    { type: "finance", kind: "expense", parentId: null },
    { type: "appointment", requestedByUserId: null, assignedStaffProfileId: null },
    { type: "attendance", kind: "staff", staffProfileId: "sp-doc", patient: null },
    { type: "blogPost", isPublished: false },
    { type: "message", senderUserId: null },
  ];

  it.each(everyResource)("has full CRUD on $type", (resource) => {
    for (const action of ACTIONS) {
      expect(can(admin, action, resource)).toBe(true);
    }
  });

  it("reads and updates About and Settings but cannot delete them", () => {
    for (const type of ["clinicProfile", "settings"] as const) {
      expect(can(admin, "read", { type })).toBe(true);
      expect(can(admin, "update", { type })).toBe(true);
      expect(can(admin, "delete", { type })).toBe(false);
    }
  });

  it("can run and record RAG queries for any patient", () => {
    const query: Resource = { type: "ragQuery", patient: assignedChild };
    expect(can(admin, "create", query)).toBe(true);
    expect(can(admin, "read", query)).toBe(true);
  });
});

describe("staff / doctor", () => {
  const patient: Resource = { type: "patient", patient: assignedChild };
  const record: Resource = {
    type: "clinicalRecord",
    kind: "session_note",
    patient: assignedChild,
  };

  it("reads and edits an assigned patient, never deletes", () => {
    expect(can(doctor, "read", patient)).toBe(true);
    expect(can(doctor, "update", patient)).toBe(true);
    expect(can(doctor, "delete", patient)).toBe(false);
  });

  it("cannot open a patient who is not assigned to them", () => {
    expect(can(otherDoctor, "read", patient)).toBe(false);
    expect(can(otherDoctor, "update", patient)).toBe(false);
  });

  it("does not admit new patients", () => {
    expect(scopeFor(doctor, "create", "patient")).toBe("none");
  });

  it("adds and edits records of assigned patients only", () => {
    expect(can(doctor, "create", record)).toBe(true);
    expect(can(doctor, "update", record)).toBe(true);
    expect(can(doctor, "delete", record)).toBe(false);
    expect(can(otherDoctor, "create", record)).toBe(false);
  });

  it("writes session records and RAG queries for own patients only", () => {
    const record: Resource = { type: "sessionRecord", patient: assignedChild, staffProfileId: "sp-doc" };
    const rag: Resource = { type: "ragQuery", patient: assignedChild };
    expect(can(doctor, "create", record)).toBe(true);
    expect(can(doctor, "update", record)).toBe(true);
    expect(can(doctor, "delete", record)).toBe(false);
    expect(can(doctor, "create", rag)).toBe(true);
    expect(can(otherDoctor, "update", record)).toBe(false);
    expect(can(otherDoctor, "read", rag)).toBe(false);
  });

  it("never matches 'own' without a staff profile", () => {
    const orphan: PatientScope = { assignedStaffProfileIds: [], parentIds: [] };
    expect(can(staffWithoutProfile, "read", { type: "patient", patient: orphan })).toBe(false);
    expect(
      can(staffWithoutProfile, "read", {
        type: "appointment",
        requestedByUserId: null,
        assignedStaffProfileId: null,
      }),
    ).toBe(false);
  });

  it("has no access to finance, users, blog, About, inbox or settings", () => {
    const denied: ResourceType[] = [
      "finance",
      "user",
      "blogPost",
      "clinicProfile",
      "message",
      "settings",
    ];
    for (const type of denied) {
      for (const action of ACTIONS) {
        expect(scopeFor(doctor, action, type), `${action} ${type}`).toBe("none");
      }
    }
  });

  it("views assigned events only and cannot change them", () => {
    const mine: Resource = {
      type: "event",
      isPublic: false,
      assignedStaffProfileIds: ["sp-doc"],
    };
    const notMine: Resource = {
      type: "event",
      isPublic: true,
      assignedStaffProfileIds: ["sp-doc2"],
    };
    expect(can(doctor, "read", mine)).toBe(true);
    expect(can(doctor, "update", mine)).toBe(false);
    expect(can(doctor, "read", notMine)).toBe(false);
  });

  it("reads and updates only their own staff profile", () => {
    expect(can(doctor, "read", { type: "staffProfile", staffProfileId: "sp-doc" })).toBe(true);
    expect(can(doctor, "update", { type: "staffProfile", staffProfileId: "sp-doc" })).toBe(true);
    expect(can(doctor, "read", { type: "staffProfile", staffProfileId: "sp-doc2" })).toBe(false);
    expect(can(doctor, "create", { type: "staffProfile", staffProfileId: "sp-doc" })).toBe(false);
  });

  it("views only the appointments assigned to them", () => {
    const mine: Resource = {
      type: "appointment",
      requestedByUserId: null,
      assignedStaffProfileId: "sp-doc",
    };
    expect(can(doctor, "read", mine)).toBe(true);
    expect(can(doctor, "update", mine)).toBe(false);
    expect(can(otherDoctor, "read", mine)).toBe(false);
  });

  it("marks attendance for own sessions and own check-in only", () => {
    const ownCheckIn: Resource = {
      type: "attendance",
      kind: "staff",
      staffProfileId: "sp-doc",
      patient: null,
    };
    const ownSession: Resource = {
      type: "attendance",
      kind: "patient",
      staffProfileId: "sp-doc",
      patient: assignedChild,
    };
    expect(can(doctor, "create", ownCheckIn)).toBe(true);
    expect(can(doctor, "create", ownSession)).toBe(true);
    expect(can(otherDoctor, "create", ownCheckIn)).toBe(false);
    expect(can(doctor, "delete", ownCheckIn)).toBe(false);
  });
});

describe("parent", () => {
  it("reads their own child's file, nobody else's, and cannot edit", () => {
    const patient: Resource = { type: "patient", patient: assignedChild };
    expect(can(parent, "read", patient)).toBe(true);
    expect(can(parent, "update", patient)).toBe(false);
    expect(can(otherParent, "read", patient)).toBe(false);
  });

  it("reads status, prescriptions and report cards but not clinical notes", () => {
    for (const kind of ["status", "prescription", "report_card"] as const) {
      expect(
        can(parent, "read", { type: "clinicalRecord", kind, patient: assignedChild }),
      ).toBe(true);
    }
    for (const kind of ["session_note", "assessment", "intake"] as const) {
      expect(
        can(parent, "read", { type: "clinicalRecord", kind, patient: assignedChild }),
      ).toBe(false);
    }
  });

  it("has no access to therapy sessions or RAG", () => {
    expect(can(parent, "read", { type: "therapySession", patient: assignedChild, staffProfileId: null })).toBe(false);
    expect(can(parent, "read", { type: "ragQuery", patient: assignedChild })).toBe(false);
  });

  it("sees own invoices and receipts, uploads proof, nothing else in finance", () => {
    const invoice: Resource = { type: "finance", kind: "invoice", parentId: "p-1" };
    expect(can(parent, "read", invoice)).toBe(true);
    expect(can(parent, "create", { type: "finance", kind: "payment", parentId: "p-1" })).toBe(true);
    expect(can(parent, "update", invoice)).toBe(false);
    expect(can(otherParent, "read", invoice)).toBe(false);
    expect(can(parent, "read", { type: "finance", kind: "expense", parentId: "p-1" })).toBe(false);
  });

  it("requests appointments and tracks only their own", () => {
    const own: Resource = {
      type: "appointment",
      requestedByUserId: "u-parent",
      assignedStaffProfileId: null,
    };
    expect(can(parent, "create", own)).toBe(true);
    expect(can(parent, "read", own)).toBe(true);
    expect(can(parent, "update", own)).toBe(false);
    expect(can(otherParent, "read", own)).toBe(false);
  });

  it("sees public events and published posts only", () => {
    expect(can(parent, "read", { type: "event", isPublic: true, assignedStaffProfileIds: [] })).toBe(true);
    expect(can(parent, "read", { type: "event", isPublic: false, assignedStaffProfileIds: [] })).toBe(false);
    expect(can(parent, "read", { type: "blogPost", isPublished: true })).toBe(true);
    expect(can(parent, "read", { type: "blogPost", isPublished: false })).toBe(false);
  });

  it("sends messages and reads only their own", () => {
    expect(can(parent, "create", { type: "message", senderUserId: "u-parent" })).toBe(true);
    expect(can(parent, "read", { type: "message", senderUserId: "u-parent" })).toBe(true);
    expect(can(parent, "read", { type: "message", senderUserId: "u-parent2" })).toBe(false);
  });

  it("views their child's attendance but not staff attendance", () => {
    expect(
      can(parent, "read", {
        type: "attendance",
        kind: "patient",
        staffProfileId: "sp-doc",
        patient: assignedChild,
      }),
    ).toBe(true);
    expect(
      can(parent, "read", {
        type: "attendance",
        kind: "staff",
        staffProfileId: "sp-doc",
        patient: null,
      }),
    ).toBe(false);
  });

  it("has no access to staff, users or settings", () => {
    for (const type of ["staffProfile", "user", "settings"] as const) {
      for (const action of ACTIONS) {
        expect(scopeFor(parent, action, type)).toBe("none");
      }
    }
  });
});

describe("anonymous visitor", () => {
  it("may submit appointment requests and contact messages", () => {
    expect(
      can(null, "create", {
        type: "appointment",
        requestedByUserId: null,
        assignedStaffProfileId: null,
      }),
    ).toBe(true);
    expect(can(null, "create", { type: "message", senderUserId: null })).toBe(true);
  });

  it("may read public content and nothing private", () => {
    expect(can(null, "read", { type: "clinicProfile" })).toBe(true);
    expect(can(null, "read", { type: "blogPost", isPublished: true })).toBe(true);
    expect(can(null, "read", { type: "blogPost", isPublished: false })).toBe(false);
    expect(
      can(null, "read", { type: "appointment", requestedByUserId: null, assignedStaffProfileId: null }),
    ).toBe(false);
    expect(can(null, "read", { type: "message", senderUserId: null })).toBe(false);
    expect(can(null, "read", { type: "dashboard" })).toBe(false);
    expect(can(null, "update", { type: "clinicProfile" })).toBe(false);
  });
});

describe("assertCan", () => {
  it("throws ForbiddenError when denied and passes when allowed", () => {
    expect(() => assertCan(doctor, "read", { type: "user" })).toThrow(ForbiddenError);
    expect(() => assertCan(admin, "read", { type: "user" })).not.toThrow();
  });
});

describe("phase 2: clinical core", () => {
  const patient = (ids: string[]): PatientScope => ({ assignedStaffProfileIds: ids, parentIds: ["p-1"] });
  const mine = patient(["sp-doc"]);
  const theirs = patient(["sp-doc2"]);

  it("only admins admit, cancel and upgrade, and manage assignments", () => {
    expect(scopeFor(admin, "create", "admission")).toBe("all");
    expect(scopeFor(doctor, "create", "admission")).toBe("none");
    expect(can(doctor, "read", { type: "admission", patient: mine })).toBe(true);
    expect(can(doctor, "read", { type: "admission", patient: theirs })).toBe(false);
    for (const action of ACTIONS) {
      expect(scopeFor(doctor, action, "patientAssignment")).toBe("none");
      expect(scopeFor(admin, action, "patientAssignment")).toBe("all");
    }
  });

  it("only admins enroll; staff read their own patients' enrollments", () => {
    expect(can(admin, "create", { type: "enrollment", patient: theirs })).toBe(true);
    expect(can(doctor, "create", { type: "enrollment", patient: mine })).toBe(false);
    expect(can(doctor, "read", { type: "enrollment", patient: mine })).toBe(true);
    expect(can(doctor, "read", { type: "enrollment", patient: theirs })).toBe(false);
  });

  it("only admins schedule and reschedule; staff see sessions they run or of their patients", () => {
    const runByMe: Resource = { type: "therapySession", patient: theirs, staffProfileId: "sp-doc" };
    const ofMyPatient: Resource = { type: "therapySession", patient: mine, staffProfileId: "sp-doc2" };
    const unrelated: Resource = { type: "therapySession", patient: theirs, staffProfileId: "sp-doc2" };
    expect(can(doctor, "read", runByMe)).toBe(true);
    expect(can(doctor, "read", ofMyPatient)).toBe(true);
    expect(can(doctor, "read", unrelated)).toBe(false);
    expect(can(doctor, "create", ofMyPatient)).toBe(false);
    expect(can(doctor, "update", runByMe)).toBe(false);
    expect(can(admin, "update", unrelated)).toBe(true);
  });

  it("goals and stage records: staff add and edit for assigned patients, never delete", () => {
    const goal: Resource = { type: "clinicalRecord", kind: "goal", patient: mine };
    expect(can(doctor, "create", goal)).toBe(true);
    expect(can(doctor, "update", goal)).toBe(true);
    expect(can(doctor, "delete", goal)).toBe(false);
    expect(can(otherDoctor, "read", goal)).toBe(false);
    expect(can(admin, "delete", goal)).toBe(true);
  });

  it("medical files: staff upload and read for assigned patients; only admins delete", () => {
    expect(can(doctor, "create", { type: "medicalFile", patient: mine })).toBe(true);
    expect(can(doctor, "read", { type: "medicalFile", patient: mine })).toBe(true);
    expect(can(doctor, "delete", { type: "medicalFile", patient: mine })).toBe(false);
    expect(can(otherDoctor, "read", { type: "medicalFile", patient: mine })).toBe(false);
  });

  it("staff read templates; only admins manage them", () => {
    expect(can(doctor, "read", { type: "formTemplate" })).toBe(true);
    expect(can(doctor, "update", { type: "formTemplate" })).toBe(false);
    expect(can(admin, "update", { type: "formTemplate" })).toBe(true);
  });

  it("staff cannot see colleagues' attendance", () => {
    const colleague: Resource = { type: "attendance", kind: "staff", staffProfileId: "sp-doc2", patient: null };
    expect(can(doctor, "read", colleague)).toBe(false);
    expect(can(doctor, "update", { type: "attendance", kind: "staff", staffProfileId: "sp-doc", patient: null })).toBe(true);
  });

  it("parents and anonymous visitors have no access to any phase 2 resource", () => {
    const phase2: ResourceType[] = ["admission", "patientAssignment", "enrollment", "therapySession", "sessionRecord", "medicalFile", "formTemplate"];
    for (const type of phase2) {
      for (const action of ACTIONS) {
        expect(scopeFor(parent, action, type), `parent ${action} ${type}`).toBe("none");
        expect(scopeFor(null, action, type), `anonymous ${action} ${type}`).toBe("none");
      }
    }
    expect(can(parent, "read", { type: "medicalFile", patient: mine })).toBe(false);
    expect(can(null, "read", { type: "patient", patient: mine })).toBe(false);
  });
});
