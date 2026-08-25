import type { TraitLayerConfig } from "@/features/lib/traits/types";
import type { Collection, CollectionStorage } from "@/features/types/domain/collections";
import type { NFT } from "@/features/types/domain/nfts";

/** Application-level contract for the "create collection" use case. */
export interface CreateCollectionInput {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  maxSupply: number;
  mintPrice: number;
  /** Mutable mint window stored in the database only. */
  mintStartDate?: string | null;
  mintEndDate?: string | null;
  creatorFee: number;
  platformFee: number;
  /** Generative configuration: layers -> values -> weights. */
  traitLayers?: TraitLayerConfig[];
  metadataBaseUri: string;
  /** IPFS reference bundle from `uploadCollectionAssets` — required once assets exist. */
  assets?: CollectionStorage;
  /** maxSupply-based deployment fee; falls back to the flat legacy fee. */
  creationCost?: number;
  /**
   * Imported, already-authored NFTs. Stored as an UNMINTED pool — minting
   * hands one over, it never generates a token.
   */
}

export type CreateCollectionResult = Collection;
