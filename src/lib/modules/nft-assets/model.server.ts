import mongoose, { Schema, type Model } from "mongoose";
import { newId, nowIso } from "@/lib/config/helpers";
import type { CreateNftAssetInput, NftAssetDocument } from "./types.server";

/**
 * NFT assets module — Mongoose model + pure factories.
 *
 * A row is one UNMINTED token: references (IPFS) plus everything needed to
 * mint it. Rows are consumed once the mint is verified.
 *
 * SERVER-ONLY.
 */

export const NFT_ASSETS_COLLECTION = "nft_assets";

const NftAssetSchema = new Schema<NftAssetDocument>(
  {
    id: { type: String, required: true },
    collectionId: { type: String, required: true },
    NFTMintId: { type: Number, required: true },
    NFTokenID: { type: Number, default: null },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, default: 0 },
    imageUri: { type: String, required: true },
    metadataUri: { type: String, required: true },
    cid: { type: String, required: true },
    name: { type: String },
    description: { type: String },
    image: { type: String },
    attributes: { type: Schema.Types.Mixed },
    traits: { type: Schema.Types.Mixed },
    rarityScore: { type: Number },
    rarityRank: { type: Number },
    rarityRankTotal: { type: Number },
    imported: { type: Boolean },
    status: { type: String, required: true, enum: ["unminted", "reserved"], default: "unminted" },
    reservedBy: { type: String },
    reservedAt: { type: String },
    error: { type: String },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: NFT_ASSETS_COLLECTION, _id: false, versionKey: false, minimize: false },
);

NftAssetSchema.index({ id: 1 }, { unique: true });
NftAssetSchema.index({ collectionId: 1, NFTMintId: 1 }, { unique: true });
NftAssetSchema.index({ collectionId: 1, status: 1 });

export const NftAssetModel: Model<NftAssetDocument> =
  (mongoose.models["NftAsset"] as Model<NftAssetDocument> | undefined) ??
  mongoose.model<NftAssetDocument>("NftAsset", NftAssetSchema);

/** Builds one UNMINTED asset row from an uploaded asset reference. */
export function createNftAssetDocument(input: CreateNftAssetInput): NftAssetDocument {
  const timestamp = nowIso();
  return {
    id: newId("ast"),
    collectionId: input.collectionId,
    NFTMintId: input.NFTMintId,
    NFTokenID: null,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    imageUri: input.imageUri,
    metadataUri: input.metadataUri,
    cid: input.cid,
    name: input.name,
    description: input.description,
    image: input.image,
    attributes: input.attributes,
    traits: input.traits,
    rarityScore: input.rarityScore,
    rarityRank: input.rarityRank,
    rarityRankTotal: input.rarityRankTotal,
    imported: input.imported,
    status: input.status ?? "unminted",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Builds the full document set for a collection upload. */
export function createNftAssetDocuments(
  inputs: ReadonlyArray<CreateNftAssetInput>,
): NftAssetDocument[] {
  return inputs.map(createNftAssetDocument);
}
