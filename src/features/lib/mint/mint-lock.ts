import { MOCK_DB_PREFIX } from "@/features/lib/data/app-data";

/**
 * Cross-tab mint lock. LocalStorage is shared between tabs, so a short-lived
 * lock key is enough to stop the same asset being minted twice.
 */
const LOCK_PREFIX = `${MOCK_DB_PREFIX}mintlock.`;
/** A lock older than this is considered abandoned (crashed tab / reload). */
export const MINT_LOCK_TTL_MS = 5 * 60 * 1000;

const memory = new Map<string, number>();

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readLock(assetId: string): number | null {
  const local = store();
  const raw = local ? local.getItem(`${LOCK_PREFIX}${assetId}`) : null;
  const value = raw ? Number(raw) : (memory.get(assetId) ?? null);
  return Number.isFinite(value) && value ? Number(value) : null;
}

export function isMintLocked(assetId: string): boolean {
  const at = readLock(assetId);
  if (!at) return false;
  if (Date.now() - at > MINT_LOCK_TTL_MS) {
    releaseMintLock(assetId);
    return false;
  }
  return true;
}

/** Returns false when another tab/request already holds the lock. */
export function acquireMintLock(assetId: string): boolean {
  if (isMintLocked(assetId)) return false;
  const at = Date.now();
  memory.set(assetId, at);
  store()?.setItem(`${LOCK_PREFIX}${assetId}`, String(at));
  return true;
}

export function releaseMintLock(assetId: string): void {
  memory.delete(assetId);
  store()?.removeItem(`${LOCK_PREFIX}${assetId}`);
}
