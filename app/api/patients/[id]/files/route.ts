import { ForbiddenError } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES } from "@/lib/file-type";
import { NotFoundError } from "@/server/errors";
import { UploadRejectedError, uploadFile } from "@/server/services/files";
import { getCurrentUser } from "@/server/session";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload a medical file to a patient record (multipart field `file`, optional
 * `description`). Same-origin only; the session and patient assignment are
 * checked in the service.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/patients/[id]/files">) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return json(403, { error: "Cross-site upload refused." });

  const actor = await getCurrentUser();
  if (!actor) return json(401, { error: "Please sign in again." });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json(413, { error: "Files can be at most 10 MB." });

  const { id } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "The upload could not be read." });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json(400, { error: "Choose a file to upload." });
  const description = form.get("description");

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const created = await uploadFile(actor, id, {
      name: file.name,
      bytes,
      description: typeof description === "string" ? description : undefined,
    });
    return json(201, { id: created.id });
  } catch (error) {
    if (error instanceof UploadRejectedError) return json(415, { error: error.message });
    if (error instanceof NotFoundError || error instanceof ForbiddenError) return json(404, { error: "Patient not found." });
    console.error("[upload] unexpected error", error);
    return json(500, { error: "The upload failed. Please try again." });
  }
}
