/**
 * One-time migration of pre-rebrand save data (BITSOL) to the CryptoCore keys.
 *
 * Runs on import, before any persisted store hydrates, so existing players keep
 * their rig, vault and gear after the rename.
 */
const KEY_MAP: Record<string, string> = {
  "bitsol.player": "cryptocore.player",
  "bitsol.equipment": "cryptocore.equipment",
  "bitsol.chests": "cryptocore.chests",
  "bitsol.notifications": "cryptocore.notifications",
  "bitsol-auth": "cryptocore-auth",
};

let migrated = false;

export function migrateLegacySaves(): void {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
      const legacy = window.localStorage.getItem(oldKey);
      if (legacy === null) continue;
      if (window.localStorage.getItem(newKey) === null) {
        window.localStorage.setItem(newKey, legacy);
      }
      window.localStorage.removeItem(oldKey);
    }
  } catch {
    // Storage unavailable (private mode / blocked) — nothing to migrate.
  }
}

migrateLegacySaves();
