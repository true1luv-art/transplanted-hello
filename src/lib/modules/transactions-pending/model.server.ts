import mongoose, { Schema, type Model } from "mongoose";
import { newId, nowIso } from "@/lib/config/helpers";
import type {
  CreatePendingTransactionInput,
  PendingTransaction,
  TransactionType,
} from "./types.server";

/**
 * Pending transactions module — the work queue.
 *
 * SERVER-ONLY.
 */

export const TRANSACTIONS_PENDING_COLLECTION = "transactions_pending";

const PendingTransactionSchema = new Schema<PendingTransaction>(
  {
    id: { type: String, required: true },
    transactionId: { type: String, required: true },
    requestId: { type: String, required: true },
    type: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "processed", "failed"],
      default: "pending",
    },
    userId: { type: String, required: true },
    hiveAccount: { type: String, required: true },
    collectionId: { type: String },
    nftId: { type: String },
    listingId: { type: String },
    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: "HIVE" },
    payload: { type: Schema.Types.Mixed, required: true },
    hiveTransactionId: { type: String },
    attempts: { type: Number, required: true, default: 0 },
    lockedBy: { type: String },
    lockedAt: { type: String },
    error: { type: String },
    payouts: { type: Schema.Types.Mixed, default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    processedAt: { type: String },
  },
  { collection: TRANSACTIONS_PENDING_COLLECTION, _id: false, versionKey: false, minimize: false },
);

PendingTransactionSchema.index({ id: 1 }, { unique: true });
PendingTransactionSchema.index({ transactionId: 1 }, { unique: true });
PendingTransactionSchema.index({ requestId: 1 }, { unique: true });
PendingTransactionSchema.index({ status: 1, createdAt: 1 });
PendingTransactionSchema.index({ status: 1, lockedAt: 1 });
PendingTransactionSchema.index({ hiveAccount: 1, createdAt: 1 });

export const PendingTransactionModel: Model<PendingTransaction> =
  (mongoose.models["PendingTransaction"] as Model<PendingTransaction> | undefined) ??
  mongoose.model<PendingTransaction>("PendingTransaction", PendingTransactionSchema);

/** Fresh application transaction id. */
export function newTransactionId(): string {
  return newId("tx");
}

/** Builds a queued transaction (status `pending`, 0 attempts). */
export function createPendingDocument<T extends TransactionType>(
  input: CreatePendingTransactionInput<T>,
): PendingTransaction {
  const timestamp = nowIso();
  return {
    id: newId("ptx"),
    transactionId: newTransactionId(),
    requestId: input.requestId,
    type: input.type,
    status: "pending",
    userId: input.userId,
    hiveAccount: input.hiveAccount,
    collectionId: input.collectionId,
    nftId: input.nftId,
    listingId: input.listingId,
    amount: input.amount ?? 0,
    currency: "HIVE",
    payload: input.payload as Record<string, unknown>,
    hiveTransactionId: input.hiveTransactionId,
    attempts: 0,
    payouts: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
