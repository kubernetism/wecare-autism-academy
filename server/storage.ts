import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";

/**
 * Private file storage behind a small interface. Development uses the local
 * disk driver (FILE_STORAGE_DIR, default `.data/uploads`, gitignored and
 * outside `public/`). Production needs an object-storage driver (for example
 * Vercel Blob in private mode or S3) implementing the same interface.
 * Files are only ever served through the authorised route handler.
 */
export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** A web stream of the stored bytes, or null if missing. */
  get(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>;
  delete(key: string): Promise<void>;
}

class LocalDiskStorage implements FileStorage {
  constructor(private readonly root: string) {}

  private path(key: string): string {
    if (!/^[a-zA-Z0-9/_-]+$/.test(key)) throw new Error("Invalid storage key");
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const full = this.path(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes, { flag: "wx", mode: 0o600 });
  }

  async get(key: string) {
    const full = this.path(key);
    try {
      const info = await stat(full);
      return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>, size: info.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}

let storage: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (!storage) {
    // turbopackIgnore: a runtime-configured directory must not make the build
    // trace the whole project (which could pull uploaded files into the output).
    storage = new LocalDiskStorage(resolve(/* turbopackIgnore: true */ process.env.FILE_STORAGE_DIR ?? ".data/uploads"));
  }
  return storage;
}
