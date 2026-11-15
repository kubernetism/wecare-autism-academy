/**
 * Detects an upload's real type from its bytes (never from the file name or
 * the browser-supplied MIME type). Only the types the clinic needs are allowed.
 */

export type AllowedFileType = {
  mime: "image/png" | "image/jpeg" | "image/webp" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  extension: "png" | "jpg" | "webp" | "pdf" | "docx";
  label: string;
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const target = Array.from(needle, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - target.length; i++) {
    for (let j = 0; j < target.length; j++) if (bytes[i + j] !== target[j]) continue outer;
    return true;
  }
  return false;
}

export function detectFileType(bytes: Uint8Array): AllowedFileType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", extension: "png", label: "PNG image" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg", label: "JPEG image" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return { mime: "image/webp", extension: "webp", label: "WebP image" };
  if (ascii(bytes, 0, 5) === "%PDF-") return { mime: "application/pdf", extension: "pdf", label: "PDF document" };
  // DOCX is a ZIP whose entries include word/document.xml (entry names are stored uncompressed).
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(bytes, "word/document.xml") && containsAscii(bytes, "[Content_Types].xml")) {
    return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx", label: "Word document" };
  }
  return null;
}
