import { z } from "zod";

import { validateTraitConfig, type TraitLayerConfig } from "@/features/lib/traits";

const hiveAccount = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, "").toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9.-]{3,16}$/, "Invalid Hive account name"));

const requestId = z.string().trim().min(8).max(120);

const ipfsUri = z
  .string()
  .trim()
  .regex(/^ipfs:\/\/[a-zA-Z0-9]{10,}(\/.+)?$/, "Must be a canonical ipfs:// URI");

export const assetReferenceSchema = z.object({
  NFTMintId: z.number().int().min(1),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(3).max(80),
  size: z.number().int().min(0),
  imageUri: ipfsUri,
  metadataUri: ipfsUri,
  cid: z.string().trim().min(10).max(120),
});

/** Reference-only asset bundle — raw file data is never accepted here. */
export const collectionAssetsSchema = z.object({
  collectionImageUri: ipfsUri,
  collectionMetadataUri: ipfsUri,
  assetRootUri: ipfsUri,
  metadataRootUri: ipfsUri,
  reusableAssets: z.boolean().default(false),
  items: z.array(assetReferenceSchema).min(1).max(100_000),
});

export const traitValueSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  weight: z.number().finite().min(0).max(1_000_000),
  enabled: z.boolean().default(true),
  assetId: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const traitLayerSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  order: z.number().int().min(0).max(999),
  enabled: z.boolean().default(true),
  values: z.array(traitValueSchema).min(1).max(500),
});

/** An imported NFT record. Traits come from the creator's metadata verbatim. */
export const importedNftSchema = z.object({
  tokenId: z.number().int().min(0),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(""),
  image: z.string().trim().max(500).default(""),
  imageUri: ipfsUri,
  metadataUri: ipfsUri,
  attributes: z
    .array(
      z.object({
        trait_type: z.string().trim().min(1).max(120),
        value: z.union([z.string().max(200), z.number()]),
      }),
    )
    .max(100)
    .default([]),
  rarityScore: z.number().nonnegative(),
  rarityRank: z.number().int().min(0),
});

export const createCollectionSchema = z
  .object({
    requestId,
    name: z.string().trim().min(3).max(60),
    symbol: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]+$/, "Symbol must be alphanumeric")),
    description: z.string().trim().min(10).max(600),
    image: z.string().trim().max(500).optional(),
    maxSupply: z.number().int().min(1).max(100_000),
    mintPrice: z.number().min(0).max(1_000_000),
    creatorFee: z.number().min(0).max(50),
    platformFee: z.number().min(0).max(50),
    /** Legacy generative config — optional, the importer never sends it. */
    traitLayers: z.array(traitLayerSchema).max(50).optional(),
    importedNfts: z.array(importedNftSchema).max(100_000).optional(),
    metadataBaseUri: z.string().trim().max(300).optional(),
    assets: collectionAssetsSchema,
  })
  .superRefine((data, ctx) => {
    // Legacy generative path only: validate weights/coverage when layers are sent.
    if (data.traitLayers?.length) {
      for (const issue of validateTraitConfig(
        data.traitLayers as TraitLayerConfig[],
        data.maxSupply,
      )) {
        ctx.addIssue({ code: "custom", path: ["traitLayers"], message: issue.message });
      }
    }

    // Imported dataset: token ids must be unique and cover the declared supply.
    if (data.importedNfts?.length) {
      const ids = new Set<number>();
      for (const nft of data.importedNfts) {
        if (ids.has(nft.tokenId)) {
          ctx.addIssue({
            code: "custom",
            path: ["importedNfts"],
            message: `Duplicate token id ${nft.tokenId}`,
          });
        }
        ids.add(nft.tokenId);
      }
      if (data.importedNfts.length !== data.maxSupply) {
        ctx.addIssue({
          code: "custom",
          path: ["importedNfts"],
          message: `Imported ${data.importedNfts.length} NFTs but maximum supply is ${data.maxSupply}`,
        });
      }
    }
  });

export const mintSchema = z.object({
  requestId,
  collectionId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const listSchema = z.object({
  requestId,
  nftId: z.string().trim().min(1),
  price: z.number().min(0.001).max(1_000_000),
});

export const buySchema = z.object({
  requestId,
  listingId: z.string().trim().min(1),
});

export const cancelSchema = buySchema;

export const transferSchema = z.object({
  requestId,
  nftId: z.string().trim().min(1),
  to: hiveAccount,
});

export type CreateCollectionBody = z.infer<typeof createCollectionSchema>;
export type MintBody = z.infer<typeof mintSchema>;
export type ListBody = z.infer<typeof listSchema>;
export type BuyBody = z.infer<typeof buySchema>;
export type TransferBody = z.infer<typeof transferSchema>;
