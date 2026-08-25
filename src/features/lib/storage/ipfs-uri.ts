/**
 * IPFS URI resolver — the single place that converts between canonical
 * `ipfs://CID[/path]` references (what we store) and public gateway HTTP URLs
 * (what the browser renders). Reads always go through a PUBLIC gateway, never
 * through our Pinata account.
 */

const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/** CIDv0 (Qm…) or CIDv1 (base32, `b…`). */
const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,}|[A-Za-z0-9]{46,})$/;

export interface ParsedIpfsUri {
  cid: string;
  /** path inside a directory CID, without leading slash. `""` when absent. */
  path: string;
}

export function publicGateway(): string {
  const configured =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.["VITE_IPFS_GATEWAY"] as string | undefined)
      : undefined;
  const gateway = configured?.trim() || DEFAULT_GATEWAY;
  return gateway.endsWith("/") ? gateway : `${gateway}/`;
}

/** Canonical reference for a CID (plus optional inner path). */
export function toIpfsUri(cid: string, path?: string): string {
  const clean = (path ?? "").replace(/^\/+/, "");
  return clean ? `ipfs://${cid}/${clean}` : `ipfs://${cid}`;
}

export function isCid(value: string): boolean {
  return CID_PATTERN.test(value.trim());
}

/**
 * Accepts `ipfs://CID/path`, `/ipfs/CID/path`, a bare CID, or a gateway URL.
 * Returns `null` for anything that is not IPFS content.
 */
export function parseIpfsUri(value: string | null | undefined): ParsedIpfsUri | null {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  let rest: string | null = null;
  if (/^ipfs:\/\//i.test(raw)) rest = raw.slice(7);
  else if (/^ipfs:/i.test(raw)) rest = raw.slice(5);
  else if (raw.startsWith("/ipfs/")) rest = raw.slice(6);
  else {
    const gatewayMatch = /^https?:\/\/[^/]+\/ipfs\/(.+)$/i.exec(raw);
    if (gatewayMatch) rest = gatewayMatch[1] ?? null;
    else if (isCid(raw)) rest = raw;
  }
  if (!rest) return null;

  rest = rest.replace(/^\/+/, "");
  const [cid, ...segments] = rest.split("/");
  if (!cid || !isCid(cid)) return null;
  return { cid, path: segments.filter(Boolean).join("/") };
}

export function isIpfsUri(value: string | null | undefined): boolean {
  return parseIpfsUri(value) !== null;
}

/**
 * Percent-encodes each path segment so filenames containing `#`, `?` or spaces
 * (e.g. `otters-#10.png`) survive as a gateway URL instead of being parsed as a
 * URL fragment. Already-encoded segments are normalised, never double-encoded.
 */
function encodeIpfsPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        decoded = segment;
      }
      return encodeURIComponent(decoded);
    })
    .join("/");
}

/**
 * Public HTTP URL for an IPFS reference. Non-IPFS values (blob:, data:, http
 * previews, relative paths) are returned untouched so existing previews keep
 * working; unusable values return `null` so the UI can show its fallback.
 */
export function resolveIpfsUrl(
  value: string | null | undefined,
  options?: { gateway?: string },
): string | null {
  if (!value) return null;
  const parsed = parseIpfsUri(value);
  if (parsed) {
    const gateway = options?.gateway
      ? options.gateway.endsWith("/")
        ? options.gateway
        : `${options.gateway}/`
      : publicGateway();
    return parsed.path
      ? `${gateway}${parsed.cid}/${encodeIpfsPath(parsed.path)}`
      : `${gateway}${parsed.cid}`;
  }
  if (/^(https?:|data:|blob:|\/)/i.test(value.trim())) return value;
  return null;
}
