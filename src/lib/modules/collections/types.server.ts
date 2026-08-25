import type { TraitLayerConfig } from "@/features/lib/traits/types";

export type CollectionDocumentStatus = "draft" | "active" | "paused" | "sold_out" | "completed";

/**
 * Creation lifecycle, surfaced to the creator UI.
 * A collection is only ACTIVE once CREATE_COLLECTION has been confirmed.
 */
export type CollectionCreationState =
  "DRAFT" | "UPLOADING" | "ASSETS_READY" | "PENDING" | "PROCESSING" | "ACTIVE" | "FAILED";

export interface CollectionDocument {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator: string;
  maxSupply: number;
  minted: number;
  mintPrice: number;
  currency: "HIVE";
  creatorFee: number;
  platformFee: number;
  /** Generative trait configuration (layers -> values -> weights). */
  traitLayers?: TraitLayerConfig[] | undefined;
  metadataBaseUri: string;
  status: CollectionDocumentStatus;
  creationState: CollectionCreationState;
  /** ipfs:// URI of the collection artwork. */
  collectionImageUri?: string | undefined;
  /** ipfs:// URI of the collection metadata JSON. */
  collectionMetadataUri?: string | undefined;
  /** ipfs:// root of the NFT image directory. */
  assetRootUri?: string | undefined;
  /** ipfs:// root of the NFT metadata directory. */
  metadataRootUri?: string | undefined;
  /** number of indexed NFT assets (see the `nft_assets` module). */
  assetCount?: number | undefined;
  /** creator opted into reusing assets instead of 1 asset per token. */
  reusableAssets?: boolean | undefined;
  creationError?: string | undefined;
  /** indexed market stats (derived; blockchain wins in Phase 3) */
  floorPrice: number;
  volume: number;
  holders: number;
  trendingScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  name: string;
  symbol: string;
  description: string;
  image?: string | undefined;
  creator: string;
  maxSupply: number;
  mintPrice: number;
  creatorFee: number;
  platformFee: number;
  traitLayers?: TraitLayerConfig[] | undefined;
  metadataBaseUri?: string | undefined;
  creationState?: CollectionCreationState | undefined;
  status?: CollectionDocumentStatus | undefined;
  collectionImageUri?: string | undefined;
  collectionMetadataUri?: string | undefined;
  assetRootUri?: string | undefined;
  metadataRootUri?: string | undefined;
  assetCount?: number | undefined;
  reusableAssets?: boolean | undefined;
}
