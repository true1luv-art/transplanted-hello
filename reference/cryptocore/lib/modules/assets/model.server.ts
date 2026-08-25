import mongoose, { Schema, type Model } from "mongoose";
import type { IAsset } from "./types.server";

const MarketSchema = new Schema(
  {
    price: { type: Number, required: true },
    listedAt: { type: Number, required: true },
    isMarket: { type: Boolean, default: true },
  },
  { _id: false },
);

const AssetSchema = new Schema<IAsset>(
  {
    assetNumber: { type: Number, required: true, unique: true, index: true },
    templateId: { type: Number, required: true, index: true },
    kind: { type: String, required: true },
    owner: { type: String, required: true, index: true },
    soulbound: { type: Boolean, default: false },
    mintNumber: { type: Number, required: true },
    equipped: { type: Boolean, default: false },
    market: { type: MarketSchema, default: null },
    createdAt: { type: Number, default: () => Date.now() },
    lastTransfer: { type: Number, default: 0 },
  },
  { collection: "assets" },
);

AssetSchema.index({ owner: 1, kind: 1, equipped: 1 });
AssetSchema.index({ "market.isMarket": 1, "market.listedAt": -1 }, { sparse: true });

export const AssetModel: Model<IAsset> =
  mongoose.models["Asset"] ?? mongoose.model<IAsset>("Asset", AssetSchema);
