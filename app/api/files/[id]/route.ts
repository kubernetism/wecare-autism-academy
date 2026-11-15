import { ForbiddenError } from "@/lib/permissions";
import { NotFoundError } from "@/server/errors";
import { openFile } from "@/server/services/files";
import { getCurrentUser } from "@/server/session";

/**
 * Authorised download of a medical file. There is no public URL: every
 * request re-checks the session and the patient assignment. Anything the
 * user may not see answers 404, so file IDs cannot be probed.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const actor = await getCurrentUser();
  if (!actor) return new Response("Please sign in.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  try {
    const { meta, stream, size } = await openFile(actor, id);
    const inline = meta.contentType.startsWith("image/") || meta.contentType === "application/pdf";
    const encoded = encodeURIComponent(meta.originalName);
    return new Response(stream, {
      headers: {
        "Content-Type": meta.contentType,
        "Content-Length": String(size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) {
      return new Response("Not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[download] unexpected error", error);
    return new Response("Something went wrong.", { status: 500 });
  }
}
