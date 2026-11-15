import { describe, expect, it } from "vitest";
import { detectFileType } from "./file-type";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)));

describe("detectFileType", () => {
  it("recognises allowed types by content", () => {
    expect(detectFileType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "rest"))?.mime).toBe("image/png");
    expect(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectFileType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))?.mime).toBe("image/webp");
    expect(detectFileType(bytes("%PDF-1.7\n"))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes([0x50, 0x4b, 0x03, 0x04], "....[Content_Types].xml....word/document.xml"))?.extension).toBe("docx");
  });

  it("rejects disguised and unsupported files", () => {
    expect(detectFileType(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(bytes("MZ\x90\x00"))).toBeNull(); // Windows executable
    expect(detectFileType(bytes([0x50, 0x4b, 0x03, 0x04], "plain zip without word parts"))).toBeNull();
    expect(detectFileType(bytes("GIF89a"))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});
