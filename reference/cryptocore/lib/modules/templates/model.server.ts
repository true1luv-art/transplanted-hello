import mongoose, { Schema, type Model } from "mongoose";
import type { ITemplate } from "./types.server";

const TemplateSchema = new Schema<ITemplate>(
  {
    _id: { type: Number, required: true },
    kind: { type: String, required: true, index: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    // Cosmetics
    maxSupply: { type: Number, default: null },
    soulbound: { type: Boolean, default: false },
    // Items
    slot: { type: String, default: null },
    rarity: { type: String, default: null },
    // Shared tracking
    mintCount: { type: Number, default: 0 },
  },
  {
    collection: "templates",
    // _id is our numeric templateId — disable Mongoose auto-ObjectId
    _id: false,
  },
);

// Compound index for item template lookups by slot + rarity
TemplateSchema.index({ slot: 1, rarity: 1 });

export const TemplateModel: Model<ITemplate> =
  mongoose.models["Template"] ?? mongoose.model<ITemplate>("Template", TemplateSchema);
