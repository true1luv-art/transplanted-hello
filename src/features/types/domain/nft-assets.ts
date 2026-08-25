import type { HiveNftProperties } from "@/lib/chain/nft-properties";
import type { NFTAttribute } from "@/features/types/domain/nfts";

/**
 * Prepared, UNMINTED NFT record — the client mirror of the `nft-assets`
 * database collection. Lifecycle:
 *
 *   generator/import -> nft-assets (draft) -> IPFS upload (uploaded)
 *                    -> mint transaction -> nfts
 *
 * `imageUri` / `metadataUri` are canonical `ipfs://…` references; gateway URLs
 * are derived at render time and never persisted.
 */
export type NftAssetStatus = "draft" | "uploading" | "uploaded" | "failed" | "reserved" | "minted";

export interface NftAsset {
  id: string;
  collectionId: string;
  /**
   * FILE / IMAGE number of the asset (the number in `otters-#11.png`).
   * It says nothing about mint order or blockchain token id.
   */
  NFTMintId: number;
  /**
   * Chronological mint number inside this collection, assigned by the mint
   * queue. `null` for every asset sitting in unminted inventory.
   */
  NftMintedNumber: number | null;
  /** REAL blockchain token id, read back from Hive at mint time. */
  NFTokenID: number | null;
  /** Blockchain-shaped custom properties; `metadata` is a JSON STRING. */
  properties: HiveNftProperties;
  name: string;
  description: string;
  filename: string;
  mimeType: string;
  size: number;
  /** CID returned for the uploaded NFT image. */
  imageCid?: string | undefined;
  /** CID returned for the uploaded NFT metadata JSON. */
  metadataCid?: string | undefined;
  /** Root CID of the image batch directory. */
  imageRootCid?: string | undefined;
  /** Root CID of the metadata batch directory. */
  metadataRootCid?: string | undefined;
  /** `ipfs://CID` of the image, once uploaded. */
  imageUri?: string | undefined;
  /** `ipfs://CID` of the metadata JSON, once uploaded. */
  metadataUri?: string | undefined;
  /** Legacy alias for `imageCid`. */
  cid?: string | undefined;
  attributes: NFTAttribute[];
  rarityScore?: number | undefined;
  rarityRank?: number | undefined;
  rarityRankTotal?: number | undefined;
  dna?: string | undefined;
  status: NftAssetStatus;
  error?: string | undefined;
  createdAt: string;
  updatedAt: string;
}
