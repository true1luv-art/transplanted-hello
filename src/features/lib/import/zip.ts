/**
 * ZIP reading for the collection importer.
 *
 * The creator never uploads thousands of loose files: they upload the ZIP
 * archives their export tool produced. This module unpacks an archive in
 * memory (browser and Node alike) and exposes its entries.
 *
 * Nothing is stored here — extraction happens before validation and the bytes
 * are only pinned (mock IPFS) once the package is valid.
 */
import { unzip } from "fflate";

export interface ZipEntry {
  /** Full path inside the archive, e.g. `batch-1-100/images/otter-#1.png`. */
  path: string;
  /** Basename, e.g. `otter-#1.png`. */
  name: string;
  bytes: Uint8Array;
}

/** A ZIP archive to import. `bytes` keeps this usable in Node tests. */
export interface ZipSource {
  name: string;
  bytes: Uint8Array;
}

export class ZipReadError extends Error {
  constructor(
    public readonly zipName: string,
    message: string,
  ) {
    super(message);
    this.name = "ZipReadError";
  }
}

const IGNORED = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|\._)/i;

/** Unpacks an archive into its file entries (directories and junk removed). */
export async function readZip(source: ZipSource): Promise<ZipEntry[]> {
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(source.bytes, (error, data) => {
      if (error)
        reject(new ZipReadError(source.name, `Could not read ${source.name}: ${error.message}`));
      else resolve(data);
    });
  });

  const entries: ZipEntry[] = [];
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith("/") || IGNORED.test(path)) continue;
    entries.push({ path, name: path.split("/").pop() ?? path, bytes });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

/** Reads a browser File / Blob into a ZipSource. */
export async function zipSourceFromFile(file: File): Promise<ZipSource> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Archive name without the `.zip` extension. */
export const zipBaseName = (name: string) => name.replace(/\.zip$/i, "");

/**
 * The single root folder every entry shares, if there is one.
 * `batch/images/a.png` + `batch/metadata/a.json` -> `batch`.
 */
export function rootFolderOf(entries: ZipEntry[]): string | null {
  let root: string | null = null;
  for (const entry of entries) {
    const segments = entry.path.split("/");
    if (segments.length < 2) return null;
    const first = segments[0]!;
    if (root === null) root = first;
    else if (root !== first) return null;
  }
  return root;
}

/**
 * Deterministic 64-bit (FNV-1a based) content hash rendered as hex.
 * Mock stand-in for a real CID digest: identical bytes -> identical hash, so
 * duplicate artwork is detectable even when filenames differ.
 */
export function mockFileHash(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b1;
  for (let i = 0; i < bytes.length; i++) {
    h1 = (h1 ^ bytes[i]!) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(bytes[i]! + i, 0x85ebca6b)) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** Wraps a zip entry as a File so the storage pipeline can pin it unchanged. */
export function entryToFile(entry: ZipEntry, mimeType: string): File {
  const view = new Uint8Array(entry.bytes.length);
  view.set(entry.bytes);
  return new File([view], entry.name, { type: mimeType });
}

export const textOf = (entry: ZipEntry) => new TextDecoder().decode(entry.bytes);
