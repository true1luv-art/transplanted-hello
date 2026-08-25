import type { MintTransactionStatus } from "@/lib/chain/types";

export type { MintTransactionStatus };

/**
 * Local record of a REAL Hive mint attempt. It is the recovery journal: while
 * a record is `pending`/`signing`/`broadcasted` the asset is locked, and a
 * `broadcasted` record whose token id could not be read yet can be resumed.
 */
export interface MintTransactionRecord {
  id: string;
  type: "NFT_MINT";
  status: MintTransactionStatus;
  assetId: string;
  collectionId: string;
  /** Hive account that signed the issuance. */
  account: string;
  symbol: string;
  /** REAL Hive transaction id — never fabricated. */
  txId?: string | undefined;
  /** REAL blockchain token id, once the sidechain exposes it. */
  NFTokenID?: number | null | undefined;
  error?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

/** Stages surfaced to the UI while a mint runs. */
export type MintStage =
  | "idle"
  | "preparing"
  | "metadata"
  | "signing"
  | "broadcasted"
  | "confirming"
  | "confirmed"
  | "failed";

export interface MintProgress {
  stage: MintStage;
  message: string;
}
