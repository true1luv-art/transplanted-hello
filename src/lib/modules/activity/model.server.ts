import mongoose, { Schema, type Model } from "mongoose";
import { newId, nowIso } from "@/lib/config/helpers";
import type { ActivityDocument, CreateActivityInput } from "./types.server";

/**
 * Activity module — Mongoose model + pure factories.
 *
 * SERVER-ONLY.
 */

export const ACTIVITY_COLLECTION = "activity";

const ActivitySchema = new Schema<ActivityDocument>(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    actor: { type: String, required: true },
    target: { type: String },
    nftId: { type: String },
    collectionId: { type: String },
    label: { type: String, required: true },
    amount: { type: Number },
    transactionId: { type: String },
    hiveTransactionId: { type: String },
    createdAt: { type: String, required: true },
  },
  { collection: ACTIVITY_COLLECTION, _id: false, versionKey: false, minimize: false },
);

ActivitySchema.index({ id: 1 }, { unique: true });
ActivitySchema.index({ collectionId: 1, createdAt: 1 });
ActivitySchema.index({ nftId: 1, createdAt: 1 });
ActivitySchema.index({ actor: 1, createdAt: 1 });
ActivitySchema.index({ transactionId: 1, type: 1 });

export const ActivityModel: Model<ActivityDocument> =
  (mongoose.models["Activity"] as Model<ActivityDocument> | undefined) ??
  mongoose.model<ActivityDocument>("Activity", ActivitySchema);

export function createActivityDocument(input: CreateActivityInput): ActivityDocument {
  return {
    ...input,
    id: newId("act"),
    createdAt: input.createdAt ?? nowIso(),
  };
}

/** Maps a persisted activity record to the UI shape. */
export function toActivityView(doc: ActivityDocument) {
  return {
    id: doc.id,
    type: doc.type,
    actor: doc.actor,
    target: doc.target,
    nftId: doc.nftId,
    collectionId: doc.collectionId,
    label: doc.label,
    amount: doc.amount,
    txId: doc.hiveTransactionId ?? doc.transactionId,
    createdAt: doc.createdAt,
  };
}
