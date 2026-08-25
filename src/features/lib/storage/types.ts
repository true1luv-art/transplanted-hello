/**
 * Storage abstraction (Phase 2.5B).
 *
 * The application depends ONLY on `StorageProvider`. Today the single
 * implementation is `MockIPFSProvider`; Phase 3 can add Pinata / Kubo /
 * Filebase providers behind the same interface without touching a single line
 * of collection-creation code.
 *
 *   StorageProvider
 *     └── MockIPFSProvider          (current)
 *         PinataProvider            (future)
 *         KuboProvider              (future)
 *         FilebaseProvider          (future)
 */

/** Raw upload input. `content` is bytes or text — never a DOM File at this layer. */
export interface StorageFileInput {
  filename: string;
  mimeType: string;
  content: Uint8Array | string;
}

/** Result of a single upload. `uri` is always the canonical `ipfs://CID`. */
export interface StorageObject {
  cid: string;
  /** canonical reference — `ipfs://<cid>` */
  uri: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** Result of a directory upload: the root CID plus every entry inside it. */
export interface StorageDirectory {
  cid: string;
  uri: string;
  entries: StorageObject[];
  size: number;
  createdAt: string;
}

export interface UploadProgress {
  /** completed uploads */
  completed: number;
  total: number;
  filename: string;
  phase: "uploading" | "pinning" | "done";
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  /** Pin the content after upload. Mock provider tracks pins in memory. */
  pin?: boolean;
  signal?: AbortSignal | undefined;
}

export interface StorageProvider {
  readonly name: string;
  uploadFile(file: StorageFileInput, options?: UploadOptions): Promise<StorageObject>;
  uploadFiles(files: StorageFileInput[], options?: UploadOptions): Promise<StorageObject[]>;
  uploadJson(filename: string, data: unknown, options?: UploadOptions): Promise<StorageObject>;
  uploadDirectory(
    name: string,
    files: StorageFileInput[],
    options?: UploadOptions,
  ): Promise<StorageDirectory>;
  /** Canonical URI for a CID (optionally a path inside a directory). */
  getUri(cid: string, path?: string): string;
  pin(cid: string): Promise<void>;
  unpin(cid: string): Promise<void>;
}

export class StorageError extends Error {
  readonly code = "STORAGE_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/** Upload lifecycle used by the index and by the creation UI. */
export type AssetStatus = "pending" | "uploading" | "uploaded" | "failed";
