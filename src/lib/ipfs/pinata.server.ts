/**
 * Pinata upload client — SERVER ONLY.
 *
 * Credentials (`PINATA_JWT`, or `PINATA_API_KEY` + `PINATA_API_SECRET`) are read
 * from `process.env` inside each function so they are never bundled into the
 * client and never evaluated at module scope (env is injected per request).
 *
 * Reads are NOT routed through Pinata: the browser resolves `ipfs://` URIs
 * through a public gateway (see `features/lib/storage/ipfs-uri.ts`).
 */

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export class PinataError extends Error {
  readonly code = "PINATA_ERROR";
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "PinataError";
    this.status = status;
  }
}

export interface PinataFileInput {
  filename: string;
  mimeType: string;
  content: Uint8Array | string;
}

export interface PinnedObject {
  cid: string;
  uri: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface PinnedDirectory {
  cid: string;
  uri: string;
  size: number;
  createdAt: string;
  entries: PinnedObject[];
}

/** Auth headers, JWT preferred. Throws a 500-class error when unconfigured. */
function authHeaders(): Record<string, string> {
  const jwt = process.env["PINATA_JWT"];
  if (jwt) return { Authorization: `Bearer ${jwt}` };

  const key = process.env["PINATA_API_KEY"];
  const secret = process.env["PINATA_API_SECRET"];
  if (key && secret) return { pinata_api_key: key, pinata_secret_api_key: secret };

  throw new PinataError("IPFS uploads are not configured on the server", 500);
}

export function pinataConfigured(): boolean {
  return Boolean(
    process.env["PINATA_JWT"] ||
      (process.env["PINATA_API_KEY"] && process.env["PINATA_API_SECRET"]),
  );
}

const now = () => new Date().toISOString();
const toBlob = (input: PinataFileInput) =>
  new Blob([typeof input.content === "string" ? input.content : new Uint8Array(input.content)], {
    type: input.mimeType || "application/octet-stream",
  });
const byteLength = (input: PinataFileInput) =>
  typeof input.content === "string"
    ? new TextEncoder().encode(input.content).byteLength
    : input.content.byteLength;

async function post(url: string, body: FormData | string, jsonBody: boolean) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(),
      ...(jsonBody ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text.slice(0, 300);
    if (response.status === 401 || response.status === 403) {
      const blocked = /plan usage limit|blocked/i.test(detail);
      throw new PinataError(
        blocked
          ? "Pinata rejected the upload: the account is blocked because it reached its plan usage limit. Upgrade the Pinata plan or free up storage, then retry."
          : `Pinata rejected the credentials (${response.status}). Check PINATA_JWT / PINATA_API_KEY.`,
        response.status,
      );
    }
    if (response.status === 429) {
      throw new PinataError("Pinata rate limit reached — retry in a moment.", 429);
    }
    throw new PinataError(`Pinata upload failed (${response.status}): ${detail}`);
  }

  let parsed: { IpfsHash?: string; PinSize?: number } | null = null;
  try {
    parsed = JSON.parse(text) as { IpfsHash?: string; PinSize?: number };
  } catch {
    throw new PinataError("Pinata returned an unreadable response");
  }
  if (!parsed?.IpfsHash) throw new PinataError("Pinata response contained no CID");
  return parsed as { IpfsHash: string; PinSize?: number };
}

/** Pins a single file. Returns the canonical `ipfs://CID` reference. */
export async function pinFile(input: PinataFileInput): Promise<PinnedObject> {
  const form = new FormData();
  form.append("file", toBlob(input), input.filename);
  form.append("pinataMetadata", JSON.stringify({ name: input.filename }));
  const result = await post(PIN_FILE_URL, form, false);
  return {
    cid: result.IpfsHash,
    uri: `ipfs://${result.IpfsHash}`,
    filename: input.filename,
    mimeType: input.mimeType,
    size: result.PinSize ?? byteLength(input),
    createdAt: now(),
  };
}

/** Pins a JSON document. */
export async function pinJson(filename: string, data: unknown): Promise<PinnedObject> {
  const result = await post(
    PIN_JSON_URL,
    JSON.stringify({ pinataMetadata: { name: filename }, pinataContent: data }),
    true,
  );
  const body = JSON.stringify(data);
  return {
    cid: result.IpfsHash,
    uri: `ipfs://${result.IpfsHash}`,
    filename,
    mimeType: "application/json",
    size: result.PinSize ?? new TextEncoder().encode(body).byteLength,
    createdAt: now(),
  };
}

/**
 * Pins many files as ONE directory (wrapWithDirectory) so the collection gets a
 * single asset root CID; each entry is addressable as `ipfs://root/<filename>`.
 */
export async function pinDirectory(
  name: string,
  files: PinataFileInput[],
): Promise<PinnedDirectory> {
  if (files.length === 0) throw new PinataError("No files to upload", 400);
  const form = new FormData();
  for (const file of files) {
    form.append("file", toBlob(file), `${name}/${file.filename}`);
  }
  form.append("pinataMetadata", JSON.stringify({ name }));
  form.append("pinataOptions", JSON.stringify({ wrapWithDirectory: false }));
  const result = await post(PIN_FILE_URL, form, false);
  const root = result.IpfsHash;
  const createdAt = now();
  return {
    cid: root,
    uri: `ipfs://${root}`,
    size: result.PinSize ?? files.reduce((sum, file) => sum + byteLength(file), 0),
    createdAt,
    entries: files.map((file) => ({
      cid: root,
      uri: `ipfs://${root}/${file.filename}`,
      filename: file.filename,
      mimeType: file.mimeType,
      size: byteLength(file),
      createdAt,
    })),
  };
}
