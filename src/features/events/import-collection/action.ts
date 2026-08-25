import { createCollection } from "@/features/events/create-collection/action";
import { CREATOR_FEE_PERCENT, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import type {
  ImportCollectionInput,
  ImportCollectionOptions,
  ImportCollectionResult,
} from "@/features/types/import";
import { collectionCreationCost } from "@/lib/config/config";
import { traitLayersFromImport } from "@/features/lib/import/derive";
import { uploadImportedCollection } from "@/features/lib/import/pipeline";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { buildNftAsset } from "@/features/mocks/data/nft-assets/model";
import { nftAssetsRepository } from "@/features/mocks/data/nft-assets/repository";

/**
 * Imports an already-authored collection: pins the archives, turns the
 * validated import report into NFT records and deploys the collection.
 *
 * Nothing is generated here — the tokens exist inside the uploaded archives.
 */
export async function importCollection(
  input: ImportCollectionInput,
  options: ImportCollectionOptions = {},
): Promise<ImportCollectionResult> {
  const { report } = input;
  if (!report.ready) throw new Error("Import archives are not valid yet");

  const name = input.name.trim();
  const symbol = input.symbol.trim().toUpperCase();
  const description = input.description.trim();
  const supply = report.statistics.totalNfts;
  const creationCost = collectionCreationCost(supply);

  if (input.balance < creationCost) {
    throw new Error(`Insufficient HIVE balance — importing ${supply} NFTs costs ${creationCost}`);
  }

  const bundle = await uploadImportedCollection(
    {
      name,
      symbol,
      description,
      creator: usersRepository.currentUsername(),
      maxSupply: supply,
      mintPrice: input.mintPrice,
      collectionImage: input.collectionImage,
      imageFiles: input.imageFiles,
      nfts: report.nfts,
      width: input.manifest?.width,
      height: input.manifest?.height,
      traits: input.manifest?.traits,
    },
    options.onUploadState,
  );

  const uriByToken = new Map(bundle.items.map((item) => [item.tokenId, item]));

  const collection = await createCollection({
    name,
    symbol,
    description,
    image: bundle.collectionImageUri,
    maxSupply: supply,
    mintPrice: input.mintPrice,
    mintStartDate: input.mintStartDate ?? null,
    mintEndDate: input.mintEndDate ?? null,
    creatorFee: CREATOR_FEE_PERCENT,
    platformFee: PLATFORM_FEE_PERCENT,
    traitLayers: traitLayersFromImport(report),
    metadataBaseUri: bundle.metadataRootUri,
    creationCost,
    assets: {
      collectionImageCid: bundle.collectionImageCid,
      collectionImageUri: bundle.collectionImageUri,
      collectionMetadataCid: bundle.collectionMetadataCid,
      collectionMetadataUri: bundle.collectionMetadataUri,
      assetRootCids: bundle.assetRootCids,
      metadataRootCids: bundle.metadataRootCids,
      assetRootUris: bundle.assetRootUris,
      metadataRootUris: bundle.metadataRootUris,
      assetRootUri: bundle.assetRootUri,
      metadataRootUri: bundle.metadataRootUri,
      assetCount: bundle.items.length,
      reusableAssets: false,
    },
  });

  nftAssetsRepository.insertMany(
    report.nfts.map((nft) => {
      const ref = uriByToken.get(nft.tokenId);
      if (!ref) throw new Error(`Missing uploaded IPFS data for NFT #${nft.tokenId}`);
      return buildNftAsset({
        collectionId: collection.id,
        NFTMintId: nft.tokenId,
        name: nft.name,
        description: nft.description || description,
        filename: ref.filename,
        mimeType: ref.mimeType,
        size: ref.size,
        attributes: nft.attributes.map((attribute) => ({
          trait_type: attribute.trait_type,
          value: String(attribute.value),
        })),
        rarityScore: nft.rarityScore,
        rarityRank: nft.rarityRank,
        rarityRankTotal: report.nfts.length,
        imageCid: ref.imageCid,
        metadataCid: ref.metadataCid,
        imageRootCid: ref.imageRootCid,
        metadataRootCid: ref.metadataRootCid,
        imageUri: ref.imageUri,
        metadataUri: ref.metadataUri,
        status: "uploaded",
      });
    }),
  );

  return collection;
}
