import "server-only";
import { qualified } from "@/db/qualified";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { medicalFiles } from "@/db/schema";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/file-type";
import type { Actor } from "@/lib/permissions";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { ConflictError, NotFoundError } from "../errors";
import { getStorage } from "../storage";
import { authorizePatient } from "./patient-access";

export type MedicalFileRow = {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

export class UploadRejectedError extends Error {}

/** Staff (assigned) or admin. Type is checked from the bytes; size is capped. */
export async function uploadFile(
  actor: Actor,
  patientId: string,
  file: { name: string; bytes: Uint8Array; description?: string },
): Promise<{ id: string }> {
  const db = getDb();
  await authorizePatient(db, actor, patientId, "create", (patient) => ({ type: "medicalFile", patient }));
  if (file.bytes.byteLength === 0) throw new UploadRejectedError("The file is empty.");
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadRejectedError("Files can be at most 10 MB.");
  const type = detectFileType(file.bytes);
  if (!type) throw new UploadRejectedError("Only images (PNG, JPEG, WebP), PDF and Word (DOCX) files can be uploaded.");

  const name = file.name.replace(/[^\w .()-]/g, "_").slice(0, 150) || `file.${type.extension}`;
  const storageKey = `patients/${patientId}/${randomUUID()}`;
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const storage = getStorage();
  await storage.put(storageKey, file.bytes, type.mime);
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(medicalFiles)
        .values({
          patientId,
          storageKey,
          originalName: name,
          contentType: type.mime,
          sizeBytes: file.bytes.byteLength,
          sha256,
          description: file.description?.trim().slice(0, 300) || null,
          uploadedByUserId: actor.userId,
        })
        .returning({ id: medicalFiles.id });
      if (!row) throw new Error("Insert returned no row");
      await writeAudit(tx, { actorUserId: actor.userId, action: "medical_file.upload", entityType: "patient", entityId: patientId, after: { fileId: row.id, name, contentType: type.mime, size: file.bytes.byteLength, sha256 } });
      return row;
    });
  } catch (error) {
    await storage.delete(storageKey);
    throw error;
  }
}

export async function listFiles(actor: Actor, patientId: string): Promise<MedicalFileRow[]> {
  const db = getDb();
  await authorizePatient(db, actor, patientId, "read", (patient) => ({ type: "medicalFile", patient }));
  const rows = await db
    .select({
      id: medicalFiles.id,
      originalName: medicalFiles.originalName,
      contentType: medicalFiles.contentType,
      sizeBytes: medicalFiles.sizeBytes,
      description: medicalFiles.description,
      uploadedBy: sql<string | null>`(select name from users u where u.id = ${qualified(medicalFiles.uploadedByUserId)})`,
      createdAt: medicalFiles.createdAt,
    })
    .from(medicalFiles)
    .where(and(eq(medicalFiles.patientId, patientId), isNull(medicalFiles.deletedAt)))
    .orderBy(desc(medicalFiles.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Authorised read for the download route. Throws NotFound for anything the actor may not see. */
export async function openFile(actor: Actor, fileId: string) {
  const db = getDb();
  const [row] = await db.select().from(medicalFiles).where(and(eq(medicalFiles.id, fileId), isNull(medicalFiles.deletedAt))).limit(1);
  if (!row) throw new NotFoundError("File not found.");
  await authorizePatient(db, actor, row.patientId, "read", (patient) => ({ type: "medicalFile", patient }));
  const stored = await getStorage().get(row.storageKey);
  if (!stored) throw new NotFoundError("File not found.");
  return { meta: row, ...stored };
}

/** Admin only: soft delete (bytes are kept for the audit trail). */
export async function deleteFile(actor: Actor, fileId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [row] = await tx.select().from(medicalFiles).where(and(eq(medicalFiles.id, fileId), isNull(medicalFiles.deletedAt))).limit(1);
    if (!row) throw new NotFoundError("File not found.");
    await authorizePatient(tx, actor, row.patientId, "delete", (patient) => ({ type: "medicalFile", patient }));
    if (row.deletedAt) throw new ConflictError("Already deleted.");
    await tx.update(medicalFiles).set({ deletedAt: new Date() }).where(eq(medicalFiles.id, fileId));
    await writeAudit(tx, { actorUserId: actor.userId, action: "medical_file.delete", entityType: "patient", entityId: row.patientId, before: { fileId, name: row.originalName } });
  });
}
