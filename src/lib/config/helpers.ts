/**
 * Shared document helpers.
 *
 * BROWSER-SAFE: no server-only imports — the mock event actions and stores
 * reuse these for optimistic ids and timestamps.
 */

/**
 * Generates a fresh document id (UUID v4), optionally namespaced with a short
 * prefix so ids are self-describing in logs (`nft_9f2c…`).
 */
export function newId(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

/** Current timestamp in the canonical ISO-8601 string format. */
export function nowIso(): string {
  return new Date().toISOString();
}
