// src/lib/modules/transactions-processed/types.server.ts
import type { Document } from "mongoose";

export type ProcessedTxType = "withdrawal" | "deposit" | "market_purchase";

export type ProcessedTxMetadata =
  | { type: "withdrawal"; payoutTxHash: string }
  | { type: "deposit"; creditedAmount: number }
  | {
      type: "market_purchase";
      itemNumber: number;
      itemType: string;
      seller: string;
      price: number;
      fee: number;
    };

export type ProcessedTxOutcome = "success" | "failed";

export interface IProcessedTransaction extends Document {
  txHash: string; // unique idempotency key
  wallet: string;
  type: ProcessedTxType;
  amount: number; // negative for outflows, positive for inflows
  processedAt: number; // Unix ms
  /**
   * "success" for settled/refunded transfers, "failed" when the pending job
   * was dead-lettered (non-retryable error or max retries exhausted) and
   * removed from transactions-pending with no financial effect of its own —
   * this row is the permanent record that the attempt was made and failed.
   */
  status: ProcessedTxOutcome;
  error?: string;
  metadata?: ProcessedTxMetadata;
}
