/** Shared, runtime-neutral constants. Safe to import from UI, API and worker. */

export const HIVE_CURRENCY = "HIVE" as const;

export const PLATFORM_ACCOUNT = "hivemint";
export const MARKET_ACCOUNT = "hivemint-market";

/** Fixed revenue split: 98% creator / 2% platform. Not configurable. */
export const CREATOR_FEE_PERCENT = 98;
export const PLATFORM_FEE_PERCENT = 2;

export const PLATFORM_FEE_RATE = PLATFORM_FEE_PERCENT / 100;
export const MARKETPLACE_FEE_RATE = 0.025;
export const COLLECTION_CREATION_FEE = 25;

export const TRANSACTION_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  PROCESSED: "processed",
  FAILED: "failed",
} as const;

/** Queued platform operations — processed by the smart-contract worker. */
export const PLATFORM_TRANSACTION_TYPES = ["CREATE_COLLECTION", "MINT_NFT"] as const;

/** Direct, user-signed (Keychain) operations — never queued. */
export const DIRECT_TRANSACTION_TYPES = [
  "TRANSFER_NFT",
  "LIST_NFT",
  "BUY_NFT",
  "CANCEL_LISTING",
] as const;

export const TRANSACTION_TYPES = [
  ...PLATFORM_TRANSACTION_TYPES,
  ...DIRECT_TRANSACTION_TYPES,
] as const;

/** Ranking pool size cap: rarity rank is computed against at most this many tokens. */
export const RANK_POOL_CAP = 600;

export const API_BASE = "/api";

export const QUERY_KEYS = {
  collections: ["collections"] as const,
  collection: (id: string) => ["collections", id] as const,
  nfts: (owner?: string) => ["nfts", owner ?? "all"] as const,
  nft: (id: string) => ["nfts", id] as const,
  listings: (collectionId?: string) => ["listings", collectionId ?? "all"] as const,
  activity: (scope?: string) => ["activity", scope ?? "global"] as const,
  creatorCollections: (creator: string) => ["creator", "collections", creator] as const,
  transaction: (id: string) => ["transactions", id] as const,
  me: ["me"] as const,
  stats: ["stats"] as const,
};

export const TRANSACTION_LABELS: Record<string, string> = {
  pending: "TRANSACTION REQUESTED",
  processing: "PROCESSING",
  processed: "CONFIRMED",
  failed: "FAILED",
};
