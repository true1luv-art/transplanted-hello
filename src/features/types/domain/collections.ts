import type { TraitLayerConfig } from "@/features/lib/traits/types";

export type CollectionStatus = "Minting" | "Sold Out" | "Upcoming";

export interface CollectionSettings {
  metadataBaseUri: string;
  symbol: string;
  creatorFee: number;
  platformFee: number;
}

/** IPFS references produced by the asset upload pipeline. */
export interface CollectionStorage {
  collectionImageCid: string;
  collectionImageUri: string;
  collectionMetadataCid: string;
  collectionMetadataUri: string;
  assetRootCids: string[];
  metadataRootCids: string[];
  assetRootUris: string[];
  metadataRootUris: string[];
  /** First batch root, retained for compatibility with current minting code. */
  assetRootUri: string;
  /** First batch root, retained for compatibility with current minting code. */
  metadataRootUri: string;
  assetCount: number;
  reusableAssets: boolean;
}

export interface Collection {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  description: string;
  image: string;
  maxSupply: number;
  minted: number;
  mintPrice: number;
  /** Mutable mint window — database owned, never written to IPFS metadata. */
  mintStartDate: string | null;
  mintEndDate: string | null;
  creatorFee: number;
  platformFee: number;
  /** Generative configuration: layers -> values -> weights. */
  traitLayers: TraitLayerConfig[];
  status: CollectionStatus;
  createdAt: string;
  floorPrice: number;
  volume: number;
  holders: number;
  trendingScore: number;
  metadataBaseUri: string;
  storage?: CollectionStorage;
}
