/**
 * Metadata builders.
 *
 * Two clearly distinct documents:
 *  - COLLECTION metadata: name, symbol, description, image, supply/price/creator
 *  - NFT metadata:        name, description, image, NFTokenID, NFTMintId,
 *                         attributes + virtual-collection indexing fields
 *
 * IDENTIFIERS — never interchangeable:
 *  - `NFTokenID`  the REAL Hive blockchain NFT id. Assigned by Hive at mint
 *                 time; `null` until then. Never fabricated locally.
 *  - `NFTMintId`  the mint number inside our VIRTUAL (indexed) collection.
 *                 Assigned by the generator. Unique per virtual collection,
 *                 but the same number may exist in other virtual collections.
 *
 * All virtual collections live inside ONE actual Hive NFT collection; the
 * `collection` / `symbol` fields are what index a token back
 * into its virtual collection.
 *
 * Both documents are uploaded through the `StorageProvider`; the canonical
 * `image` field always references `ipfs://…`, never an HTTP gateway URL.
 */
import type { NFTAttribute } from "@/features/types/domain/nfts";

export interface CollectionMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  maxSupply: number;
  mintPrice: number;
  currency: "HIVE";
  creator: string;
  external_url?: string;
}

export interface NftMetadata {
  name: string;
  description: string;
  image: string;
  /** Real Hive NFT id — null until the token is minted on chain. */
  NFTokenID: number | null;
  /** Mint number inside the virtual collection. */
  NFTMintId: number;
  attributes: NFTAttribute[];
  /** Virtual-collection indexing fields. */
  collection: string;
  symbol: string;
}

export function buildCollectionMetadata(input: {
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  maxSupply: number;
  mintPrice: number;
  creator: string;
}): CollectionMetadata {
  return {
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: input.imageUri,
    maxSupply: input.maxSupply,
    mintPrice: input.mintPrice,
    currency: "HIVE",
    creator: input.creator,
  };
}

export function buildNftMetadata(input: {
  collectionName: string;
  collectionSymbol: string;
  /** Mint number in the virtual collection. */
  NFTMintId: number;
  /** Blockchain NFT id, when already minted. Never derived from NFTMintId. */
  NFTokenID?: number | null | undefined;
  description: string;
  imageUri: string;
  attributes?: NFTAttribute[];
}): NftMetadata {
  return {
    name: `${input.collectionName} #${input.NFTMintId}`,
    description: input.description,
    image: input.imageUri,
    NFTokenID: input.NFTokenID ?? null,
    NFTMintId: input.NFTMintId,
    attributes: input.attributes ?? [],
    collection: input.collectionName,
    symbol: input.collectionSymbol,
  };
}

export interface VirtualCollectionIndex {
  collection: string;
  symbol: string;
  NFTMintId: number | null;
  NFTokenID: number | null;
}

const intOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

/**
 * Derives the virtual-collection identity of a token from its NFT metadata.
 * This is how one shared Hive collection is split into many virtual ones.
 */
export function indexVirtualCollection(
  metadata: Record<string, unknown>,
): VirtualCollectionIndex | null {
  const name = metadata["collection"];
  const symbol = metadata["symbol"];
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof symbol !== "string" || !symbol.trim()) return null;
  return {
    collection: name,
    symbol: symbol,
    NFTMintId: intOrNull(metadata["NFTMintId"]),
    NFTokenID: intOrNull(metadata["NFTokenID"]),
  };
}

/** Metadata filename convention inside the metadata directory: `1.json`. */
export const metadataFilename = (NFTMintId: number) => `${NFTMintId}.json`;
