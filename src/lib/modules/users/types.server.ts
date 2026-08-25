/**
 * MongoDB document types for the `users` collection.
 *
 * Hive identity rule: the Hive account name IS the blockchain identity.
 * `username` is the canonical (and only) account identifier.
 *
 * Nothing Hive owns is stored here. Display name, profile metadata
 * (about / images / location / website) and the liquid HIVE balance are read
 * live from the chain (`getHiveAccountSnapshot`) and are deliberately NOT
 * duplicated into MongoDB — a cached copy is stale the moment the account
 * changes on chain.
 *
 * What remains is app-owned state Hive cannot hold: the app role and the
 * simulated settlement ledger used by the mock smart-contract worker.
 */

export interface UserDocument {
  id: string;
  /** Hive account name — canonical blockchain identity for this user. */
  username: string;
  /**
   * App-owned simulated spendable credit used by the mock settlement worker.
   * This is NOT the on-chain HIVE balance; real balances come from Hive.
   */
  ledgerBalance: number;
  role: "user" | "creator";
  createdAt: string;
  updatedAt: string;
}

/**
 * Read model exposed to callers: the stored document plus values derived from
 * the Hive username (never stored, never authored by the app).
 */
export interface UserView extends UserDocument {
  /** Fallback display name; the real one comes from Hive account metadata. */
  displayName: string;
  /** https://images.hive.blog/u/{username}/avatar */
  avatarUrl: string;
  /** https://images.hive.blog/u/{username}/cover */
  bannerUrl: string;
}

export interface CreateUserInput {
  /** Hive account name. */
  username: string;
  /** Optional starting simulated ledger credit (app-owned, not chain state). */
  ledgerBalance?: number;
  role?: UserDocument["role"];
}
