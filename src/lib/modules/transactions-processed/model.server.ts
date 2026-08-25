import mongoose, { Schema, type Model } from "mongoose";
import { newId, nowIso } from "@/lib/config/helpers";
import type {
  CreateProcessedTransactionInput,
  ProcessedTransaction,
} from "./types.server";

/**
 * Processed transactions module — the immutable receipt log.
 *
 * A receipt is the idempotency anchor: once one exists for a transactionId,
 * the operation is never executed again.
 *
 * SERVER-ONLY.
 */

export const TRANSACTIONS_PROCESSED_COLLECTION = "transactions_processed";

const ProcessedTransactionSchema = new Schema<ProcessedTransaction>(
  {
    id: { type: String, required: true },
    transactionId: { type: String, required: true },
    requestId: { type: String, required: true },
    type: { type: String, required: true },
    status: { type: String, required: true, enum: ["processed", "failed"], default: "processed" },
    hiveTransactionId: { type: String, required: true },
    blockNumber: { type: Number, required: true, default: 0 },
    userId: { type: String, required: true },
    hiveAccount: { type: String, required: true },
    collectionId: { type: String },
    nftId: { type: String },
    result: { type: Schema.Types.Mixed, default: {} },
    error: { type: String },
    createdAt: { type: String, required: true },
    processedAt: { type: String, required: true },
  },
  { collection: TRANSACTIONS_PROCESSED_COLLECTION, _id: false, versionKey: false, minimize: false },
);

ProcessedTransactionSchema.index({ id: 1 }, { unique: true });
ProcessedTransactionSchema.index({ transactionId: 1 }, { unique: true });
ProcessedTransactionSchema.index({ requestId: 1 });
ProcessedTransactionSchema.index({ hiveAccount: 1, processedAt: 1 });
ProcessedTransactionSchema.index({ status: 1, processedAt: 1 });

export const ProcessedTransactionModel: Model<ProcessedTransaction> =
  (mongoose.models["ProcessedTransaction"] as Model<ProcessedTransaction> | undefined) ??
  mongoose.model<ProcessedTransaction>("ProcessedTransaction", ProcessedTransactionSchema);

/** Builds a receipt document (default `processed`). */
export function createProcessedDocument(
  input: CreateProcessedTransactionInput,
): ProcessedTransaction {
  const timestamp = nowIso();
  return {
    id: newId("rcpt"),
    transactionId: input.transactionId,
    requestId: input.requestId,
    type: input.type,
    status: input.status,
    hiveTransactionId: input.hiveTransactionId,
    blockNumber: input.blockNumber ?? 0,
    userId: input.userId,
    hiveAccount: input.hiveAccount,
    collectionId: input.collectionId,
    nftId: input.nftId,
    result: input.result ?? {},
    error: input.error,
    createdAt: timestamp,
    processedAt: timestamp,
  };
}
