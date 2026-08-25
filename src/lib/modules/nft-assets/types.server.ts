import type { GeneratedTrait } from "@/features/lib/traits/types";
import type { NFTAttribute } from "@/features/lib/metadata";

/**
 * UNMINTED NFTs of a collection.
 *
 * `nft_assets` is the staging area of the mint lifecycle:
 *
 *   collections -> nft_assets (unminted) -> Hive mint -> nfts (indexed, minted)
 *
 * A row holds EVERYTHING required to mint one token (references + metadata).
 * It stores REFERENCES only — the bytes live on IPFS and the token itself
 * lives on Hive once minted. After a verified mint the row is consumed
 * (deleted) and the token is indexed in `nfts`.
 */
export type NftAssetStatus = "unminted" | "reserved";

export interface NftAssetDocument {
  id: string;
  collectionId: string;
  /** Mint number inside the virtual collection. */
  NFTMintId: number;
  /** Real Hive NFT id — always null while the asset is unminted. */
  NFTokenID?: number | null | undefined;
  filename: string;
  mimeType: string;
  size: number;
  /** `ipfs://…` of the image. */
  imageUri: string;
  /** `ipfs://…` of the NFT metadata JSON. */
  metadataUri: string;
  /** CID of the image (the metadata CID is embedded in `metadataUri`). */
  cid: string;
  /* ---- mint-ready NFT information ---------------------------------- */
  name?: string | undefined;
  description?: string | undefined;
  /** displayable image (data/URL) used by the UI before minting */
  image?: string | undefined;
  attributes?: NFTAttribute[] | undefined;
  traits?: GeneratedTrait[] | undefined;
  rarityScore?: number | undefined;
  rarityRank?: number | undefined;
  rarityRankTotal?: number | undefined;
  /** untouched creator metadata for imported collections */
  imported?: boolean | undefined;
  /* ---- lifecycle ---------------------------------------------------- */
  status: NftAssetStatus;
  /** application transaction currently minting this asset */
  reservedBy?: string | undefined;
  reservedAt?: string | undefined;
  error?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNftAssetInput {
  collectionId: string;
  NFTMintId: number;
  filename: string;
  mimeType: string;
  size: number;
  imageUri: string;
  metadataUri: string;
  cid: string;
  name?: string | undefined;
  description?: string | undefined;
  image?: string | undefined;
  attributes?: NFTAttribute[] | undefined;
  traits?: GeneratedTrait[] | undefined;
  rarityScore?: number | undefined;
  rarityRank?: number | undefined;
  rarityRankTotal?: number | undefined;
  imported?: boolean | undefined;
  status?: NftAssetStatus | undefined;
}
