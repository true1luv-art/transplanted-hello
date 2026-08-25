/**
 * Hive identity helpers — pure, dependency-free and safe to import from
 * browser code (no dHive client, no configuration, no network access).
 *
 * The Hive account name IS the identity: everything else (avatar, cover) is
 * derived from it, never stored as the authoritative value.
 */

/** Normalizes a Hive account name (lowercase, no leading `@`). */
export function normalizeHiveUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

/** Deterministic Hive avatar URL for any account. */
export function hiveAvatarUrl(username: string): string {
  return `https://images.hive.blog/u/${normalizeHiveUsername(username)}/avatar`;
}

/** Deterministic Hive cover/banner URL for any account. */
export function hiveCoverUrl(username: string): string {
  return `https://images.hive.blog/u/${normalizeHiveUsername(username)}/cover`;
}
