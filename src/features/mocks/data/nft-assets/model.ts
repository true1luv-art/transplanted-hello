import { newId } from "@/features/mocks/data/activity/model";
import { buildNftProperties } from "@/lib/chain/nft-properties";
import type { NftAsset } from "@/features/types/domain/nft-assets";

export interface CreateNftAssetInput {
  collectionId: string;
  NFTMintId: number;
  name: string;
  description: string;
  filename: string;
  mimeType: string;
  size: number;
  attributes: NftAsset["attributes"];
  imageCid?: string | undefined;
  metadataCid?: string | undefined;
  imageRootCid?: string | undefined;
  metadataRootCid?: string | undefined;
  imageUri?: string | undefined;
  metadataUri?: string | undefined;
  dna?: string | undefined;
  rarityScore?: number | undefined;
  rarityRank?: number | undefined;
  rarityRankTotal?: number | undefined;
  status?: NftAsset["status"] | undefined;
  /** Collection name + symbol, used to build the on-chain properties. */
  collectionName?: string | undefined;
  symbol?: string | undefined;
}

/** Pure factory — no storage access, no IPFS, no chain. */
export function buildNftAsset(input: CreateNftAssetInput): NftAsset {
  const timestamp = new Date().toISOString();
  return {
    id: newId("asset"),
    collectionId: input.collectionId,
    NFTMintId: input.NFTMintId,
    // Hive assigns this at mint time; a prepared asset is always unminted.
    NFTokenID: null,
    NFTMintedNumber: null,
    // Chain-shaped properties: the creator collection symbol plus the IPFS URI
    // of the metadata document (never the metadata itself).
    properties: buildNftProperties({
      collection: input.collectionName ?? input.collectionId,
      symbol: input.symbol ?? "",
      metadataUri: input.metadataUri ?? "",
    }),
    name: input.name,
    description: input.description,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    imageCid: input.imageCid,
    metadataCid: input.metadataCid,
    imageRootCid: input.imageRootCid,
    metadataRootCid: input.metadataRootCid,
    imageUri: input.imageUri,
    metadataUri: input.metadataUri,
    cid: input.imageCid,
    attributes: input.attributes,
    dna: input.dna,
    rarityScore: input.rarityScore,
    rarityRank: input.rarityRank,
    rarityRankTotal: input.rarityRankTotal,
    status: input.status ?? "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** True when both the image and the metadata have real CIDs. */
export const isAssetUploaded = (asset: NftAsset): boolean =>
  Boolean(asset.imageUri && asset.metadataUri);
