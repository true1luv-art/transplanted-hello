import mongoose, { Schema, type Model } from "mongoose";
import { generateArtwork } from "@/lib/art";
import { newId, nowIso } from "@/lib/config/helpers";
import type { CollectionDocument, CreateCollectionInput } from "./types.server";

/**
 * Collections module — Mongoose model + pure factories.
 *
 * SERVER-ONLY.
 */

export const NFT_COLLECTIONS_COLLECTION = "nft_collections";

const CollectionSchema = new Schema<CollectionDocument>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, required: true },
    creator: { type: String, required: true },
    maxSupply: { type: Number, required: true },
    minted: { type: Number, required: true, default: 0 },
    mintPrice: { type: Number, required: true },
    currency: { type: String, required: true, enum: ["HIVE"], default: "HIVE" },
    creatorFee: { type: Number, required: true, default: 5 },
    platformFee: { type: Number, required: true, default: 2.5 },
    traitLayers: { type: Array, default: undefined },
    metadataBaseUri: { type: String, default: "" },
    status: {
      type: String,
      required: true,
      enum: ["draft", "active", "paused", "sold_out", "completed"],
      default: "active",
    },
    creationState: {
      type: String,
      required: true,
      enum: [
        "DRAFT",
        "UPLOADING",
        "ASSETS_READY",
        "PENDING",
        "PROCESSING",
        "ACTIVE",
        "FAILED",
      ],
      default: "ACTIVE",
    },
    collectionImageUri: { type: String },
    collectionMetadataUri: { type: String },
    assetRootUri: { type: String },
    metadataRootUri: { type: String },
    assetCount: { type: Number, default: 0 },
    reusableAssets: { type: Boolean, default: false },
    creationError: { type: String },
    floorPrice: { type: Number, required: true, default: 0 },
    volume: { type: Number, required: true, default: 0 },
    holders: { type: Number, required: true, default: 0 },
    trendingScore: { type: Number, required: true, default: 0 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: NFT_COLLECTIONS_COLLECTION, _id: false, versionKey: false, minimize: false },
);

CollectionSchema.index({ id: 1 }, { unique: true });
CollectionSchema.index({ symbol: 1 }, { unique: true });
CollectionSchema.index({ creator: 1 });

export const CollectionModel: Model<CollectionDocument> =
  (mongoose.models["Collection"] as Model<CollectionDocument> | undefined) ??
  mongoose.model<CollectionDocument>("Collection", CollectionSchema);

export function createCollectionDocument(input: CreateCollectionInput): CollectionDocument {
  const timestamp = nowIso();
  const symbol = input.symbol.toUpperCase();
  return {
    id: newId("col"),
    name: input.name,
    symbol,
    description: input.description,
    image: input.image || generateArtwork(`collection-${symbol}-${input.name}`),
    creator: input.creator,
    maxSupply: input.maxSupply,
    minted: 0,
    mintPrice: input.mintPrice,
    currency: "HIVE",
    creatorFee: input.creatorFee,
    platformFee: input.platformFee,
    traitLayers: input.traitLayers,
    metadataBaseUri:
      input.metadataBaseUri ||
      input.metadataRootUri ||
      `https://meta.hivemint.app/${symbol.toLowerCase()}/`,
    status: input.status ?? "active",
    creationState: input.creationState ?? "ACTIVE",
    collectionImageUri: input.collectionImageUri,
    collectionMetadataUri: input.collectionMetadataUri,
    assetRootUri: input.assetRootUri,
    metadataRootUri: input.metadataRootUri,
    assetCount: input.assetCount ?? 0,
    reusableAssets: input.reusableAssets ?? false,
    floorPrice: input.mintPrice,
    volume: 0,
    holders: 0,
    trendingScore: 50,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Maps the persisted document to the shape the UI already renders. */
export function toCollectionView(doc: CollectionDocument) {
  return {
    id: doc.id,
    name: doc.name,
    symbol: doc.symbol,
    creator: doc.creator,
    description: doc.description,
    image: doc.image,
    maxSupply: doc.maxSupply,
    minted: doc.minted,
    mintPrice: doc.mintPrice,
    creatorFee: doc.creatorFee,
    platformFee: doc.platformFee,
    traitLayers: doc.traitLayers ?? [],
    status:
      doc.status === "sold_out" || doc.minted >= doc.maxSupply
        ? ("Sold Out" as const)
        : doc.status === "draft"
          ? ("Upcoming" as const)
          : ("Minting" as const),
    createdAt: doc.createdAt,
    floorPrice: doc.floorPrice,
    volume: doc.volume,
    holders: doc.holders,
    trendingScore: doc.trendingScore,
    metadataBaseUri: doc.metadataBaseUri,
    creationState: doc.creationState,
    collectionImageUri: doc.collectionImageUri,
    collectionMetadataUri: doc.collectionMetadataUri,
    assetRootUri: doc.assetRootUri,
    metadataRootUri: doc.metadataRootUri,
    assetCount: doc.assetCount ?? 0,
  };
}

/**
 * Aggregation expression keeping `status` consistent with a computed minted
 * value inside an atomic update pipeline. Draft collections stay draft.
 */
export function statusExpression(mintedExpr: unknown) {
  return {
    $cond: [
      { $eq: ["$status", "draft"] },
      "$status",
      { $cond: [{ $gte: [mintedExpr, "$maxSupply"] }, "sold_out", "active"] },
    ],
  };
}
