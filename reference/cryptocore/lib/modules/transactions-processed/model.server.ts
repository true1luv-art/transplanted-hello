// src/lib/modules/transactions-processed/model.server.ts
import mongoose, { Schema, Model } from "mongoose";
import type { IProcessedTransaction } from "./types.server";

const ProcessedTransactionSchema = new Schema<IProcessedTransaction>(
  {
    txHash: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["withdrawal", "deposit", "market_purchase"],
    },
    amount: { type: Number, required: true },
    processedAt: { type: Number, required: true },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    error: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { collection: "transactions-processed" },
);

ProcessedTransactionSchema.index({ wallet: 1, processedAt: -1 });
ProcessedTransactionSchema.index({ type: 1, processedAt: -1 });
ProcessedTransactionSchema.index({ status: 1, processedAt: -1 });

export const ProcessedTransactionModel: Model<IProcessedTransaction> =
  mongoose.models["ProcessedTransaction"] ??
  mongoose.model<IProcessedTransaction>("ProcessedTransaction", ProcessedTransactionSchema);
