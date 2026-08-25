import { generateArtwork } from "@/lib/art";
import { buildCollectionTraitLayers } from "@/features/lib/traits/presets";
import type { TraitLayerConfig } from "@/features/lib/traits/types";
import type { Collection, CollectionStorage } from "@/features/types/domain/collections";

export interface NewCollection {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  maxSupply: number;
  mintPrice: number;
  mintStartDate?: string | null;
  mintEndDate?: string | null;
  creatorFee: number;
  platformFee: number;
  traitLayers?: TraitLayerConfig[];
  metadataBaseUri: string;
  assets?: CollectionStorage;
}

/** Pure factory: draft data -> a complete Collection record. */
export function buildCollection(input: NewCollection, creator: string, id: string): Collection {
  return {
    id,
    name: input.name,
    symbol: input.symbol.toUpperCase(),
    creator,
    description: input.description,
    image: input.image || generateArtwork(`collection-${input.symbol}-${input.name}`),
    maxSupply: input.maxSupply,
    minted: 0,
    mintPrice: input.mintPrice,
    mintStartDate: input.mintStartDate ?? null,
    mintEndDate: input.mintEndDate ?? null,
    creatorFee: input.creatorFee,
    platformFee: input.platformFee,
    traitLayers:
      input.traitLayers ?? buildCollectionTraitLayers(id, input.name.split(" ").filter(Boolean)),
    status: "Minting",
    createdAt: new Date().toISOString(),
    floorPrice: input.mintPrice,
    volume: 0,
    holders: 0,
    trendingScore: 50,
    metadataBaseUri: input.metadataBaseUri,
    ...(input.assets ? { storage: input.assets } : {}),
  };
}

/** Collection state after one mint. */
export function applyMint(collection: Collection, paid: number): Collection {
  const minted = collection.minted + 1;
  return {
    ...collection,
    minted,
    volume: Number((collection.volume + paid).toFixed(2)),
    holders: collection.holders + 1,
    status: minted >= collection.maxSupply ? "Sold Out" : collection.status,
  };
}

/** Collection state after a secondary sale. */
export function applySale(collection: Collection, price: number): Collection {
  return {
    ...collection,
    volume: Number((collection.volume + price).toFixed(2)),
    floorPrice: Math.min(collection.floorPrice, price),
  };
}

export const isSoldOut = (collection: Collection) => collection.minted >= collection.maxSupply;
