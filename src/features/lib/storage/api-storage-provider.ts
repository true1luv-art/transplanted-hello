/**
 * ApiStorageProvider — real IPFS storage through OUR OWN upload API.
 *
 *   Browser -> /api/ipfs/upload -> Pinata -> IPFS -> { cid, uri }
 *
 * No Pinata credential ever reaches this layer; failures throw so callers never
 * persist a fake CID.
 */
import { toIpfsUri } from "./ipfs-uri";
import {
  StorageError,
  type StorageDirectory,
  type StorageFileInput,
  type StorageObject,
  type StorageProvider,
  type UploadOptions,
} from "./types";

const ENDPOINT = "/api/ipfs/upload";

const toBlob = (file: StorageFileInput) =>
  new Blob([typeof file.content === "string" ? file.content : new Uint8Array(file.content)], {
    type: file.mimeType || "application/octet-stream",
  });

async function request<T>(init: RequestInit, signal?: AbortSignal | undefined): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, { method: "POST", ...init, ...(signal ? { signal } : {}) });
  } catch (error) {
    throw new StorageError(
      `IPFS upload request failed: ${error instanceof Error ? error.message : "network error"}`,
    );
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `IPFS upload failed (${response.status})`;
    throw new StorageError(message);
  }
  if (!body || typeof body !== "object" || !(body as { cid?: string }).cid) {
    throw new StorageError("IPFS upload returned no CID");
  }
  return body as T;
}

export class ApiStorageProvider implements StorageProvider {
  readonly name = "pinata-api";

  async uploadFile(file: StorageFileInput, options?: UploadOptions): Promise<StorageObject> {
    options?.onProgress?.({ completed: 0, total: 1, filename: file.filename, phase: "uploading" });
    const form = new FormData();
    form.append("kind", "file");
    form.append("file", toBlob(file), file.filename);
    const result = await request<StorageObject>({ body: form }, options?.signal);
    options?.onProgress?.({ completed: 1, total: 1, filename: file.filename, phase: "done" });
    return result;
  }

  async uploadFiles(files: StorageFileInput[], options?: UploadOptions): Promise<StorageObject[]> {
    const out: StorageObject[] = [];
    for (const [index, file] of files.entries()) {
      out.push(await this.uploadFile(file, { ...(options?.signal ? { signal: options.signal } : {}) }));
      options?.onProgress?.({
        completed: index + 1,
        total: files.length,
        filename: file.filename,
        phase: index + 1 === files.length ? "done" : "uploading",
      });
    }
    return out;
  }

  async uploadJson(filename: string, data: unknown, options?: UploadOptions): Promise<StorageObject> {
    return request<StorageObject>(
      {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "json", filename, data }),
      },
      options?.signal,
    );
  }

  async uploadDirectory(
    name: string,
    files: StorageFileInput[],
    options?: UploadOptions,
  ): Promise<StorageDirectory> {
    if (files.length === 0) throw new StorageError("No files to upload");
    const form = new FormData();
    form.append("kind", "directory");
    form.append("name", name);
    for (const file of files) form.append("files", toBlob(file), file.filename);
    options?.onProgress?.({ completed: 0, total: files.length, filename: name, phase: "uploading" });
    const result = await request<StorageDirectory>({ body: form }, options?.signal);
    options?.onProgress?.({
      completed: files.length,
      total: files.length,
      filename: name,
      phase: "done",
    });
    return result;
  }

  getUri(cid: string, path?: string): string {
    return toIpfsUri(cid, path);
  }

  /** Pinning happens server-side at upload time. */
  async pin(): Promise<void> {}
  async unpin(): Promise<void> {}
}
