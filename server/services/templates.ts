import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { Database, Transaction } from "@/db/create-db";
import { formTemplates, therapies } from "@/db/schema";
import type { LifecycleStage, TemplateStatus } from "@/db/schema/enums";
import { assertCan, type Actor } from "@/lib/permissions";
import type { TemplateSchema } from "@/lib/templates/types";
import { getDb } from "../db";
import { NotFoundError } from "../errors";

export type TemplateRef = {
  id: string;
  version: number;
  title: string;
  status: TemplateStatus;
  schema: TemplateSchema;
};

/** Newest non-retired version of a therapy line's template for a stage. */
export async function currentTemplate(db: Database | Transaction, therapyId: string, stage: LifecycleStage): Promise<TemplateRef> {
  const [row] = await db
    .select({ id: formTemplates.id, version: formTemplates.version, title: formTemplates.title, status: formTemplates.status, schema: formTemplates.schema })
    .from(formTemplates)
    .where(and(eq(formTemplates.therapyId, therapyId), eq(formTemplates.stage, stage), ne(formTemplates.status, "retired")))
    .orderBy(desc(formTemplates.version))
    .limit(1);
  if (!row) throw new NotFoundError("No record template exists for this therapy and stage.");
  return { ...row, schema: row.schema as TemplateSchema };
}

/** A specific version (records keep the version they were written with). */
export async function templateById(db: Database | Transaction, id: string): Promise<TemplateRef> {
  const [row] = await db
    .select({ id: formTemplates.id, version: formTemplates.version, title: formTemplates.title, status: formTemplates.status, schema: formTemplates.schema })
    .from(formTemplates)
    .where(eq(formTemplates.id, id))
    .limit(1);
  if (!row) throw new NotFoundError("Record template not found.");
  return { ...row, schema: row.schema as TemplateSchema };
}

export type TemplateListRow = TemplateRef & { therapyName: string; therapySlug: string; stage: LifecycleStage };

export async function listTemplates(actor: Actor): Promise<TemplateListRow[]> {
  assertCan(actor, "read", { type: "formTemplate" });
  const rows = await getDb()
    .select({
      id: formTemplates.id,
      version: formTemplates.version,
      title: formTemplates.title,
      status: formTemplates.status,
      schema: formTemplates.schema,
      stage: formTemplates.stage,
      therapyName: therapies.name,
      therapySlug: therapies.slug,
    })
    .from(formTemplates)
    .innerJoin(therapies, eq(therapies.id, formTemplates.therapyId))
    .orderBy(asc(therapies.sortOrder), asc(formTemplates.stage), desc(formTemplates.version));
  return rows.map((r) => ({ ...r, schema: r.schema as TemplateSchema }));
}
