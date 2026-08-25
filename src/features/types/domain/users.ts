/** User module — identity of a Hive account inside the app. */
export interface User {
  /** Hive account name: the canonical blockchain identity. */
  username: string;
  displayName: string;
  /** Derived from the username (or the metadata image the account published). */
  avatarUrl: string;
  /** Profile banner/background from Hive account metadata, when published. */
  coverImage?: string;
  about?: string;
  location?: string;
  website?: string;
  /** true once the profile was hydrated from real Hive account data. */
  chainSynced?: boolean;
}

/** username -> HIVE balance. */
export type BalanceLedger = Record<string, number>;
