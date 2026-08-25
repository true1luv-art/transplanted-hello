/**
 * Transaction taxonomy.
 *
 * PLATFORM operations mutate supply / deploy contracts and are serialized by
 * the smart-contract worker.
 *
 * MARKETPLACE operations (transfer / list / buy / cancel) are user-signed on
 * Hive. Phase 6E lets the worker process them too: the backend verifies the
 * broadcast Hive transaction and only then synchronizes the MongoDB index.
 * The Phase 2.5 direct (mock) path through `MarketplaceService` remains for
 * the mock-based frontend and is untouched.
 */
export type PlatformTransactionType = "CREATE_COLLECTION" | "MINT_NFT";

/** User-signed (Keychain) marketplace operations. */
export type DirectTransactionType = "TRANSFER_NFT" | "LIST_NFT" | "BUY_NFT" | "CANCEL_LISTING";

/** Everything the worker can process. */
export type TransactionType = PlatformTransactionType | DirectTransactionType;

/** Anything that can end up in `transactions_processed`. */
export type AnyTransactionType = TransactionType;

export type PendingTransactionStatus = "pending" | "processing" | "processed" | "failed";

export interface PendingTransactionPayloads {
  CREATE_COLLECTION: {
    name: string;
    symbol: string;
    description: string;
    image?: string | undefined;
    maxSupply: number;
    mintPrice: number;
    creatorFee: number;
    platformFee: number;
    metadataBaseUri?: string | undefined;
  };
  MINT_NFT: { collectionId: string; quantity: number };
  TRANSFER_NFT: { nftId: string; from: string; to: string };
  LIST_NFT: { nftId: string; price: number };
  BUY_NFT: { listingId: string; nftId?: string | undefined };
  CANCEL_LISTING: { listingId: string };
}

export interface PendingTransaction {
  id: string;
  /** application transaction id, unique */
  transactionId: string;
  /** client supplied idempotency key, unique */
  requestId: string;
  type: TransactionType;
  status: PendingTransactionStatus;
  userId: string;
  hiveAccount: string;
  collectionId?: string | undefined;
  nftId?: string | undefined;
  /** marketplace listing this request operates on (list / buy / cancel). */
  listingId?: string | undefined;
  amount: number;
  currency: "HIVE";
  payload: Record<string, unknown>;
  /**
   * Blockchain transaction id, once the operation reaches Hive.
   * Distinct from `transactionId` (application id) and `requestId`
   * (client idempotency key). Optional for backward compatibility.
   */
  hiveTransactionId?: string | undefined;
  attempts: number;
  /** worker lease owner — protects against double processing */
  lockedBy?: string | undefined;
  lockedAt?: string | undefined;
  error?: string | undefined;
  createdAt: string;
  updatedAt: string;
  processedAt?: string | undefined;
  /**
   * Payout legs already settled for this transaction. Persisted leg-by-leg so
   * a retried job resumes instead of paying a recipient twice.
   */
  payouts?: PayoutRecord[] | undefined;
}

/** Recipient class of a single payout transfer. */
export type PayoutLeg = "creator" | "platform" | "seller";

/** An individual payout transfer that has been completed (or recorded as 0). */
export interface PayoutRecord {
  leg: PayoutLeg;
  account: string;
  amount: number;
  /** Hive trx id, or "retained" when no transfer was needed. */
  hiveTransactionId?: string | undefined;
  paidAt: string;
}

export interface CreatePendingTransactionInput<T extends TransactionType = TransactionType> {
  type: T;
  requestId: string;
  userId: string;
  hiveAccount: string;
  amount?: number | undefined;
  collectionId?: string | undefined;
  nftId?: string | undefined;
  listingId?: string | undefined;
  /** Hive transaction the user already broadcast for this request. */
  hiveTransactionId?: string | undefined;
  payload: T extends keyof PendingTransactionPayloads
    ? PendingTransactionPayloads[T]
    : Record<string, unknown>;
}
