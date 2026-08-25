import mongoose, { Schema, type Model } from "mongoose";
import { generateArtwork, hashString, mulberry32 } from "@/lib/art";
import { newId, nowIso } from "@/lib/config/helpers";
import { buildNftProperties } from "@/lib/chain/nft-properties";
import { generateTraits } from "@/features/lib/traits/generator";
import { calculateRarityScore } from "@/features/lib/traits/rarity";
import { DEFAULT_TRAIT_LAYERS } from "@/features/lib/traits/presets";
import type { GeneratedTrait } from "@/features/lib/traits/types";
import type { NFT, NFTAttribute } from "@/features/types/domain/nfts";
import type { CollectionDocument } from "../collections/types.server";
import type { NftAssetDocument } from "../nft-assets/types.server";
import type { NftDocument, NftDocumentStatus } from "./types.server";

/**
 * NFTs module — Mongoose model + pure factories.
 *
 * The token itself lives on Hive; this collection is the searchable index.
 *
 * SERVER-ONLY.
 */

export const NFTS_COLLECTION = "nfts";

const NftSchema = new Schema<NftDocument>(
  {
    id: { type: String, required: true },
    collectionId: { type: String, required: true },
    collectionName: { type: String, required: true },
    tokenId: { type: Number, required: true },
    hiveNftId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, required: true },
    owner: { type: String, required: true },
    imported: { type: Boolean },
    sourceMetadata: { type: Schema.Types.Mixed },
    mintNumber: { type: Number, required: true },
    NFTMintId: { type: Number, required: true },
    NFTokenID: { type: Number, default: null },
    maxSupply: { type: Number, required: true },
    metadataUri: { type: String, default: "" },
    imageUri: { type: String },
    assetId: { type: String },
    traits: { type: Schema.Types.Mixed, default: [] },
    rarityScore: { type: Number, required: true, default: 0 },
    rarityRank: { type: Number, required: true, default: 0 },
    rarityRankTotal: { type: Number, required: true, default: 0 },
    attributes: { type: Schema.Types.Mixed, default: [] },
    estimatedValue: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ["owned", "listed", "burned"],
      default: "owned",
    },
    mintTransactionId: { type: String, required: true },
    hiveTransactionId: { type: String },
    blockNumber: { type: Number },
    isListed: { type: Boolean, required: true, default: false },
    listingPrice: { type: Number },
    listingCurrency: { type: String },
    listingSeller: { type: String },
    listedAt: { type: String },
    listingTransactionId: { type: String },
    marketSyncedAt: { type: String },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: NFTS_COLLECTION, _id: false, versionKey: false, minimize: false },
);

NftSchema.index({ id: 1 }, { unique: true });
NftSchema.index({ collectionId: 1, tokenId: 1 }, { unique: true });
NftSchema.index({ owner: 1, createdAt: 1 });
NftSchema.index({ isListed: 1, listedAt: 1 });
NftSchema.index({ collectionId: 1, status: 1 });
NftSchema.index({ listingSeller: 1 });
NftSchema.index({ hiveNftId: 1 });

export const NftModel: Model<NftDocument> =
  (mongoose.models["Nft"] as Model<NftDocument> | undefined) ??
  mongoose.model<NftDocument>("Nft", NftSchema);

/** Deterministic Hive NFT instance id: `{SYMBOL}:{tokenId}`. */
export function hiveNftId(symbol: string, tokenId: number): string {
  return `${symbol}:${tokenId}`;
}

/** Statuses that count as "held" for holder statistics. */
export const HELD_STATUSES: readonly NftDocumentStatus[] = ["owned", "listed"];

function attributesFromTraits(traits: GeneratedTrait[]): NFTAttribute[] {
  return traits.map((trait) => ({ trait: trait.layerName, value: trait.traitValueName }));
}

export interface CreateNftInput {
  collection: CollectionDocument;
  mintNumber: number;
  owner: string;
  mintTransactionId: string;
  /** Deterministic seed so a replayed mint produces the same token. */
  seedKey: string;
}

/**
 * Builds an NFT document for a generative mint. Traits are rolled from the
 * collection's layer configuration with a deterministic seed.
 */
export function createNftDocument(input: CreateNftInput): NftDocument {
  const { collection, mintNumber, owner, mintTransactionId, seedKey } = input;
  const timestamp = nowIso();
  const rand = mulberry32(hashString(seedKey));
  const layers = collection.traitLayers?.length ? collection.traitLayers : DEFAULT_TRAIT_LAYERS;
  const traits = generateTraits(layers, rand);
  const rarityScore = calculateRarityScore(traits);

  return {
    id: newId("nft"),
    collectionId: collection.id,
    collectionName: collection.name,
    tokenId: mintNumber,
    hiveNftId: hiveNftId(collection.symbol, mintNumber),
    name: `${collection.name} #${mintNumber}`,
    description: collection.description,
    image: generateArtwork(`${collection.id}-${mintNumber}`),
    owner,
    mintNumber,
    NFTMintId: mintNumber,
    NFTokenID: null,
    maxSupply: collection.maxSupply,
    metadataUri: `${collection.metadataBaseUri}${mintNumber}.json`,
    traits,
    rarityScore,
    rarityRank: 0,
    rarityRankTotal: collection.maxSupply,
    attributes: attributesFromTraits(traits),
    estimatedValue: collection.mintPrice,
    status: "owned",
    mintTransactionId,
    isListed: false,
    marketSyncedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface CreateNftFromAssetInput {
  collection: CollectionDocument;
  asset: NftAssetDocument;
  mintNumber: number;
  owner: string;
  mintTransactionId: string;
}

/**
 * Builds an NFT document by consuming a pre-generated `nft_assets` row.
 * Creator-authored metadata is preserved verbatim.
 */
export function createNftDocumentFromAsset(input: CreateNftFromAssetInput): NftDocument {
  const { collection, asset, mintNumber, owner, mintTransactionId } = input;
  const timestamp = nowIso();
  const traits = asset.traits ?? [];

  return {
    id: newId("nft"),
    collectionId: collection.id,
    collectionName: collection.name,
    tokenId: asset.NFTMintId,
    hiveNftId: hiveNftId(collection.symbol, asset.NFTMintId),
    name: asset.name ?? `${collection.name} #${asset.NFTMintId}`,
    description: asset.description ?? collection.description,
    image: asset.image ?? asset.imageUri,
    owner,
    imported: asset.imported,
    sourceMetadata: asset.sourceMetadata,
    mintNumber,
    NFTMintId: asset.NFTMintId,
    NFTokenID: asset.NFTokenID ?? null,
    maxSupply: collection.maxSupply,
    metadataUri: asset.metadataUri,
    imageUri: asset.imageUri,
    assetId: asset.id,
    traits,
    rarityScore: asset.rarityScore ?? calculateRarityScore(traits),
    rarityRank: asset.rarityRank ?? 0,
    rarityRankTotal: asset.rarityRankTotal ?? collection.maxSupply,
    attributes: asset.attributes ?? attributesFromTraits(traits),
    estimatedValue: collection.mintPrice,
    status: "owned",
    mintTransactionId,
    isListed: false,
    marketSyncedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Next token id for a collection: `max(tokenId) + 1`. */
export function nextTokenId(existing: ReadonlyArray<Pick<NftDocument, "tokenId">>): number {
  let max = 0;
  for (const nft of existing) if (nft.tokenId > max) max = nft.tokenId;
  return max + 1;
}

/** Convert a stored NFT document into the UI NFT shape. */
export function toNftView(doc: NftDocument): NFT {
  return {
    id: doc.id,
    collectionId: doc.collectionId,
    collectionName: doc.collectionName,
    tokenId: doc.tokenId,
    name: doc.name,
    description: doc.description,
    image: doc.image,
    traits: doc.traits,
    rarityScore: doc.rarityScore,
    rarityRank: doc.rarityRank,
    rarityRankTotal: doc.rarityRankTotal,
    mintNumber: doc.mintNumber,
    maxSupply: doc.maxSupply,
    owner: doc.owner,
    attributes: doc.attributes,
    metadataUri: doc.metadataUri,
    estimatedValue: doc.estimatedValue,
    createdAt: doc.createdAt,
    status: doc.isListed ? "Listed" : "Owned",
    NftMintedNumber: doc.NFTokenID ?? null,
    properties: buildNftProperties({
      collection: doc.collectionName,
      symbol: doc.collectionSymbol ?? doc.collectionName,
      metadataUri: doc.metadataUri,
    }),
  };
}

/**
 * Cached listing projection of a listed NFT. The listing "id" is the NFT id —
 * Hive owns the real order, this is only the index view of it.
 */
export function toListingView(doc: NftDocument) {
  return {
    id: doc.id,
    nftId: doc.id,
    seller: doc.listingSeller ?? doc.owner,
    price: doc.listingPrice ?? 0,
    currency: "HIVE" as const,
    listedAt: doc.listedAt ?? doc.updatedAt,
    featured: false,
    nft: toNftView(doc),
  };
}
