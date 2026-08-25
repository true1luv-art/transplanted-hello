/**
 * Mock IPFS provider.
 *
 * Behaves like a real pinning service from the caller's point of view:
 *  - content addressed: the CID is derived from the bytes, so the same content
 *    always produces the same CID and different content never collides
 *  - realistic CIDv1-looking identifiers (`bafybei…`, base32 alphabet)
 *  - canonical `ipfs://CID` URIs
 *  - simulated per-file latency so progress reporting is meaningful
 *
 * It never talks to the network and requires no credentials.
 */
import { config } from "@/lib/config/config";
import { logger } from "@/lib/config/logger";
import type {
  StorageDirectory,
  StorageFileInput,
  StorageObject,
  StorageProvider,
  UploadOptions,
} from "@/features/lib/storage/types";
import { StorageError } from "@/features/lib/storage/types";

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

function toBytes(content: Uint8Array | string): Uint8Array {
  return typeof content === "string" ? new TextEncoder().encode(content) : content;
}

/**
 * FNV-1a based 256-bit digest. Deterministic, dependency free and identical in
 * the browser, the worker and Node — which is all a mock CID needs.
 */
function digest256(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  for (let lane = 0; lane < 8; lane++) {
    let h1 = 0x811c9dc5 ^ (lane * 0x9e3779b1);
    let h2 = 0x01000193 + lane * 0x85ebca6b;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!;
      h1 ^= byte + lane;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = (Math.imul(h2 ^ byte, 0x85ebca6b) + ((h1 >>> 13) | 0)) >>> 0;
    }
    const mixed = (h1 ^ h2) >>> 0;
    out[lane * 4] = (mixed >>> 24) & 0xff;
    out[lane * 4 + 1] = (h1 >>> 16) & 0xff;
    out[lane * 4 + 2] = (h2 >>> 8) & 0xff;
    out[lane * 4 + 3] = ((mixed ^ bytes.length) >>> 0) & 0xff;
  }
  return out;
}

function base32(bytes: Uint8Array, length: number): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  while (out.length < length) out += BASE32[out.length % 32];
  return out.slice(0, length);
}

/**
 * Deterministic, realistic-looking CIDv1 (base32, dag-pb/raw style prefix).
 * Same content -> same CID. Different content -> different CID.
 */
export function mockCid(content: Uint8Array | string, prefix = "bafybei"): string {
  return prefix + base32(digest256(toBytes(content)), 52);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface MockIPFSOptions {
  /** Simulated latency per upload, ms. */
  latency?: number;
  /** 0..1 chance an individual upload fails (used to exercise retries). */
  failureRate?: number;
}

export class MockIPFSProvider implements StorageProvider {
  readonly name = "mock-ipfs";
  /** cid -> stored object, so the debug view can inspect what was "pinned". */
  private readonly objects = new Map<string, StorageObject & { pinned: boolean }>();

  constructor(private readonly options: MockIPFSOptions = {}) {}

  private get latency() {
    return this.options.latency ?? config.storage.uploadLatency;
  }

  private get failureRate() {
    return this.options.failureRate ?? config.storage.failureRate;
  }

  getUri(cid: string, path?: string): string {
    return path ? `ipfs://${cid}/${path.replace(/^\//, "")}` : `ipfs://${cid}`;
  }

  async uploadFile(file: StorageFileInput, options?: UploadOptions): Promise<StorageObject> {
    if (options?.signal?.aborted) throw new StorageError("Upload aborted");
    if (!file.filename) throw new StorageError("A filename is required");
    if (this.latency > 0) await wait(this.latency);
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new StorageError(`Upload failed for ${file.filename} (mock network error)`);
    }

    const bytes = toBytes(file.content);
    const cid = mockCid(bytes);
    const object: StorageObject = {
      cid,
      uri: this.getUri(cid),
      filename: file.filename,
      mimeType: file.mimeType,
      size: bytes.byteLength,
      createdAt: new Date().toISOString(),
    };
    this.objects.set(cid, { ...object, pinned: options?.pin ?? true });
    logger.debug("STORAGE", `Pinned ${file.filename}`, { cid, size: object.size });
    options?.onProgress?.({ completed: 1, total: 1, filename: file.filename, phase: "done" });
    return object;
  }

  async uploadFiles(files: StorageFileInput[], options?: UploadOptions): Promise<StorageObject[]> {
    const out: StorageObject[] = [];
    for (const [index, file] of files.entries()) {
      options?.onProgress?.({
        completed: index,
        total: files.length,
        filename: file.filename,
        phase: "uploading",
      });
      const { onProgress: _ignored, ...rest } = options ?? {};
      out.push(await this.uploadFile(file, rest));
      options?.onProgress?.({
        completed: index + 1,
        total: files.length,
        filename: file.filename,
        phase: index + 1 === files.length ? "done" : "uploading",
      });
    }
    return out;
  }

  async uploadJson(
    filename: string,
    data: unknown,
    options?: UploadOptions,
  ): Promise<StorageObject> {
    return this.uploadFile(
      { filename, mimeType: "application/json", content: JSON.stringify(data, null, 2) },
      options,
    );
  }

  async uploadDirectory(
    name: string,
    files: StorageFileInput[],
    options?: UploadOptions,
  ): Promise<StorageDirectory> {
    const uploadedEntries = await this.uploadFiles(files, options);
    // A directory CID in IPFS is derived from its entries — mirror that here so
    // the same set of files always yields the same root.
    const manifest = uploadedEntries
      .map((e) => `${e.filename}:${e.cid}`)
      .sort()
      .join("\n");
    const cid = mockCid(`dir:${name}\n${manifest}`, "bafybei");
    const entries = uploadedEntries.map((entry) => ({
      ...entry,
      cid,
      uri: this.getUri(cid, entry.filename),
    }));
    const directory: StorageDirectory = {
      cid,
      uri: this.getUri(cid),
      entries,
      size: entries.reduce((sum, e) => sum + e.size, 0),
      createdAt: new Date().toISOString(),
    };
    this.objects.set(cid, {
      cid,
      uri: directory.uri,
      filename: name,
      mimeType: "application/x-directory",
      size: directory.size,
      createdAt: directory.createdAt,
      pinned: true,
    });
    return directory;
  }

  async pin(cid: string): Promise<void> {
    const existing = this.objects.get(cid);
    if (existing) existing.pinned = true;
  }

  async unpin(cid: string): Promise<void> {
    const existing = this.objects.get(cid);
    if (existing) existing.pinned = false;
  }

  /** Debug helper — lets the dev panel inspect everything "on IPFS". */
  list(): (StorageObject & { pinned: boolean })[] {
    return [...this.objects.values()];
  }
}
