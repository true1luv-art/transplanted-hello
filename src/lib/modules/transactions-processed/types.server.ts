import type { AnyTransactionType } from "../transactions-pending/types.server";

export type ProcessedTransactionStatus = "processed" | "failed";

export interface ProcessedTransaction {
  id: string;
  /** matches the pending transaction — unique, the idempotency anchor */
  transactionId: string;
  requestId: string;
  type: AnyTransactionType;
  status: ProcessedTransactionStatus;
  /** mock in Phase 2 (MOCK-HIVE-XXXXXXXX), real Hive trx id in Phase 3 */
  hiveTransactionId: string;
  blockNumber: number;
  userId: string;
  hiveAccount: string;
  collectionId?: string | undefined;
  nftId?: string | undefined;
  /** everything needed to reconstruct what happened */
  result: Record<string, unknown>;
  error?: string | undefined;
  createdAt: string;
  processedAt: string;
}

export interface CreateProcessedTransactionInput {
  transactionId: string;
  requestId: string;
  type: AnyTransactionType;
  status: ProcessedTransactionStatus;
  hiveTransactionId: string;
  blockNumber?: number | undefined;
  userId: string;
  hiveAccount: string;
  collectionId?: string | undefined;
  nftId?: string | undefined;
  result?: Record<string, unknown> | undefined;
  error?: string | undefined;
}
