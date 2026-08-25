// src/lib/modules/transactions-pending/types.server.ts
import type { Document } from "mongoose";

export type InboundTxStatus = "pending" | "failed" | "dead";
export type PendingTxType = "withdrawal" | "deposit" | "market_purchase";

export interface IInboundTransaction extends Document {
  type: PendingTxType;
  signature: string; // idempotency key — UUID for withdrawal/market, txId for deposit
  walletAddress: string; // payer / recipient

  withdrawAmount?: number;

  depositAmount?: number;
  depositTxId?: string;

  itemNumber?: number;
  itemType?: string;
  price?: number;
  paymentTxId?: string; // on-chain SPL payment for market purchases
  refunded?: boolean; // buyer was paid back on-chain

  status: InboundTxStatus;
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
