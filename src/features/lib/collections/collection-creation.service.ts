/**
 * Collection creation service (Phase 2.5B).
 *
 * Owns the pre-chain half of the workflow:
 *   validate asset references -> create the DRAFT/PENDING collection ->
 *   index the assets in `nft_assets` -> enqueue CREATE_COLLECTION
 *
 * The transaction payload carries IPFS REFERENCES only — never file bytes.
 * The collection only becomes ACTIVE when the smart-contract worker confirms
 * the transaction.
 */
import { collectionCreationCost } from "@/lib/config/config";
import type { TraitLayerConfig } from "@/features/lib/traits/types";
import { logger } from "@/lib/config/logger";
import { createCollectionDocument } from "@/lib/modules/collections/model.server";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { createNftAssetDocument } from "@/lib/modules/nft-assets/model.server";
import { nftAssetsRepository } from "@/lib/modules/nft-assets/repository.server";
import type { PendingTransactionPayloads } from "@/lib/modules/transactions-pending/types.server";

export class CollectionCreationError extends Error {
  readonly code = "COLLECTION_CREATION_REJECTED";
  constructor(message: string) {
    super(message);
    this.name = "CollectionCreationError";
  }
}

export interface AssetReference {
  NFTMintId: number;
  filename: string;
  mimeType: string;
  size: number;
  imageUri: string;
  metadataUri: string;
  cid: string;
}

/** One imported NFT record — already authored by the creator. */
export interface ImportedNftRecord {
  tokenId: number;
  name: string;
  description: string;
  /** original image reference from the creator metadata */
  image: string;
  imageUri: string;
  metadataUri: string;
  attributes: NFTAttribute[];
  rarityScore: number;
  rarityRank: number;
  /** untouched source metadata document */
  sourceMetadata: Record<string, unknown>;
}

export interface CollectionAssetBundle {
  collectionImageUri: string;
  collectionMetadataUri: string;
  assetRootUri: string;
  metadataRootUri: string;
  reusableAssets: boolean;
  items: AssetReference[];
}

export interface CreateCollectionRequest {
  creator: string;
  name: string;
  symbol: string;
  description: string;
  image?: string | undefined;
  maxSupply: number;
  mintPrice: number;
  creatorFee: number;
  platformFee: number;
  traitLayers?: TraitLayerConfig[] | undefined;
  metadataBaseUri?: string | undefined;
  assets: CollectionAssetBundle;
  /** Imported NFT dataset — registered as UNMINTED records. */
  importedNfts?: ImportedNftRecord[] | undefined;
}

const isIpfsUri = (value: string) => /^ipfs:\/\/[a-z0-9]{10,}(\/.+)?$/i.test(value);

/**
 * Guards rule 16: no CREATE_COLLECTION transaction may exist before every
 * required CID is present.
 */
export function assertAssetsReady(request: CreateCollectionRequest): void {
  const { assets, maxSupply } = request;
  const required: [string, string][] = [
    ["collection image", assets.collectionImageUri],
    ["collection metadata", assets.collectionMetadataUri],
    ["asset root", assets.assetRootUri],
    ["metadata root", assets.metadataRootUri],
  ];
  for (const [label, uri] of required) {
    if (!uri || !isIpfsUri(uri))
      throw new CollectionCreationError(`Missing or invalid ${label} IPFS URI`);
  }
  if (assets.items.length === 0) throw new CollectionCreationError("No NFT assets were uploaded");
  if (!assets.reusableAssets && assets.items.length < maxSupply) {
    throw new CollectionCreationError(
      `Only ${assets.items.length} of ${maxSupply} NFT assets are ready. Upload the remaining assets, lower the supply, or enable reusable assets.`,
    );
  }
  const tokens = new Set<number>();
  for (const item of assets.items) {
    if (!isIpfsUri(item.imageUri))
      throw new CollectionCreationError(`Asset ${item.filename} has no image CID`);
    if (!isIpfsUri(item.metadataUri))
      throw new CollectionCreationError(`Asset ${item.filename} has no metadata CID`);
    if (tokens.has(item.NFTMintId))
      throw new CollectionCreationError(`Duplicate token number ${item.NFTMintId}`);
    tokens.add(item.NFTMintId);
  }
}

export interface PreparedCollection {
  collectionId: string;
  creationCost: number;
  assetCount: number;
  /** Reference-only payload for the CREATE_COLLECTION transaction. */
  payload: PendingTransactionPayloads["CREATE_COLLECTION"] & Record<string, unknown>;
}

/**
 * Creates the PENDING collection row plus its asset index and returns the
 * transaction payload. Never called twice for the same requestId — the router
 * short-circuits duplicates before reaching this point.
 */
export async function prepareCollection(
  request: CreateCollectionRequest,
): Promise<PreparedCollection> {
  assertAssetsReady(request);

  const cost = collectionCreationCost(request.maxSupply);
  const symbol = request.symbol.toUpperCase();
  const existing = await nftCollectionsRepository.findOne({ symbol });
  if (existing) throw new CollectionCreationError(`Symbol ${symbol} is already taken`);

  const doc = await nftCollectionsRepository.insert(
    createCollectionDocument({
      name: request.name,
      symbol,
      description: request.description,
      image: request.image,
      creator: request.creator,
      maxSupply: request.maxSupply,
      mintPrice: request.mintPrice,
      creatorFee: request.creatorFee,
      platformFee: request.platformFee,
      traitLayers: request.traitLayers,
      metadataBaseUri: request.metadataBaseUri,
      // Not live yet: only a confirmed CREATE_COLLECTION flips this to ACTIVE.
      status: "draft",
      creationState: "PENDING",
      collectionImageUri: request.assets.collectionImageUri,
      collectionMetadataUri: request.assets.collectionMetadataUri,
      assetRootUri: request.assets.assetRootUri,
      metadataRootUri: request.assets.metadataRootUri,
      assetCount: request.assets.items.length,
      reusableAssets: request.assets.reusableAssets,
    }),
  );

  // The UNMINTED NFTs of this collection. Each row carries everything needed
  // to mint one token; imported metadata is merged in when present.
  const importedByToken = new Map(
    (request.importedNfts ?? []).map((item) => [item.tokenId, item]),
  );
  const importedTotal = request.importedNfts?.length ?? 0;

  await nftAssetsRepository.insertMany(
    request.assets.items.map((item) => {
      const imported = importedByToken.get(item.NFTMintId);
      return createNftAssetDocument({
        collectionId: doc.id,
        NFTMintId: item.NFTMintId,
        filename: item.filename,
        mimeType: item.mimeType,
        size: item.size,
        imageUri: item.imageUri,
        metadataUri: item.metadataUri,
        cid: item.cid,
        status: "unminted",
        ...(imported
          ? {
              name: imported.name,
              description: imported.description,
              image: imported.image,
              attributes: imported.attributes,
              rarityScore: imported.rarityScore,
              rarityRank: imported.rarityRank,
              rarityRankTotal: importedTotal,
              sourceMetadata: imported.sourceMetadata,
              imported: true,
            }
          : {}),
      });
    }),
  );

  if (importedTotal) {
    logger.info("IMPORT", `Staged ${importedTotal} unminted NFTs for ${doc.symbol}`, {
      collectionId: doc.id,
    });
  }

  logger.info("ASSETS", `Indexed ${request.assets.items.length} assets for ${doc.symbol}`, {
    collectionId: doc.id,
    assetRootUri: request.assets.assetRootUri,
  });

  return {
    collectionId: doc.id,
    creationCost: cost,
    assetCount: request.assets.items.length,
    payload: {
      collectionId: doc.id,
      name: doc.name,
      symbol: doc.symbol,
      description: doc.description,
      maxSupply: doc.maxSupply,
      mintPrice: doc.mintPrice,
      creatorFee: doc.creatorFee,
      platformFee: doc.platformFee,
      traitLayers: doc.traitLayers ?? [],
      metadataBaseUri: doc.metadataBaseUri,
      collectionImageUri: request.assets.collectionImageUri,
      collectionMetadataUri: request.assets.collectionMetadataUri,
      assetRootUri: request.assets.assetRootUri,
      metadataRootUri: request.assets.metadataRootUri,
      assetCount: request.assets.items.length,
      reusableAssets: request.assets.reusableAssets,
      importedNftCount: request.importedNfts?.length ?? 0,
      creationCost: cost,
    },
  };
}
