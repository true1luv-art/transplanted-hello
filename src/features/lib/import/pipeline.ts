/**
 * Import pipeline.
 *
 * buildImportReport(): pure, browser-side analysis of the creator's package.
 * uploadImportedCollection(): pins the analysed package to (mock) IPFS and
 * returns the reference bundle for CREATE_COLLECTION.
 *
 * Nothing here generates NFTs — the records already exist.
 */
import { getStorageProvider } from "@/features/lib/storage/storage";
import {
  buildCollectionManifest,
  type CollectionTraitValue,
} from "@/features/lib/storage/collection-manifest";
import { mimeFromFilename } from "@/features/lib/storage/validation";
import {
  batchImagesNamespace,
  batchMetadataNamespace,
  collectionImageFilename,
  collectionMetadataFilename,
} from "@/features/lib/generator/naming";
import type { StorageFileInput, StorageObject, StorageProvider } from "@/features/lib/storage/types";
import { StorageError } from "@/features/lib/storage/types";
import { matchImages, imageKey } from "./image-match";
import { assignRanks, buildFrequencyTable, calculateRarityScore, traitStatistics } from "./rarity";
import { resolveTokenIds, type TokenIdOptions } from "./token-id";
import { collapseIssues, validateImport } from "./validate";
import type { ImportIssue, ImportReport, ImportedNft, ParsedMetadataRecord } from "./types";

export interface BuildReportInput extends TokenIdOptions {
  records: ParsedMetadataRecord[];
  images: { name: string; previewUrl?: string | undefined }[];
  maxSupply: number;
  /** Issues produced while parsing the JSON files. */
  parseIssues?: ImportIssue[];
}

/** Analyses the imported package: matching, validation, rarity and stats. */
export function buildImportReport(input: BuildReportInput): ImportReport {
  const { records, images, maxSupply } = input;
  const filenames = images.map((i) => i.name);
  const previews = new Map(images.map((i) => [i.name, i.previewUrl]));

  const tokenIds = resolveTokenIds(records, { useImportOrder: input.useImportOrder ?? false });
  const { matched, missing, orphans } = matchImages(
    records.map((r) => r.image),
    filenames,
  );

  const issues = collapseIssues([
    ...(input.parseIssues ?? []),
    ...validateImport({
      records,
      tokenIds: tokenIds.map((t) => t.tokenId),
      matched,
      missing,
      orphans,
      imageFilenames: filenames,
      maxSupply,
    }),
  ]);

  // Rarity is calculated from the imported traits only.
  const table = buildFrequencyTable(records);
  const scored = records.map((record, index) => ({
    record,
    index,
    tokenId: tokenIds[index]?.tokenId ?? index + 1,
    source: tokenIds[index]?.source ?? "order",
    rarityScore: calculateRarityScore(table, record),
  }));
  const ranks = assignRanks(
    scored.map((s) => ({ tokenId: s.tokenId, rarityScore: s.rarityScore })),
  );

  const nfts: ImportedNft[] = scored
    .map((entry) => {
      const filename = matched.get(entry.index);
      const rank = ranks.get(entry.tokenId);
      return {
        ...entry.record,
        tokenId: entry.tokenId,
        tokenIdSource: entry.source,
        imageKey: imageKey(entry.record.image),
        matchedFilename: filename,
        previewUrl: filename ? previews.get(filename) : undefined,
        rarityScore: entry.rarityScore,
        rarityRank: rank?.rarityRank ?? 0,
      } satisfies ImportedNft;
    })
    .sort((a, b) => a.tokenId - b.tokenId);

  const traits = traitStatistics(table);
  const combinations = new Set(
    records.map((r) =>
      r.attributes
        .map((a) => `${a.trait_type}=${a.value}`)
        .sort()
        .join("|"),
    ),
  );

  return {
    nfts,
    traits,
    statistics: {
      totalNfts: records.length,
      totalImages: filenames.length,
      matchedImages: matched.size,
      missingImages: missing.length,
      orphanImages: orphans.length,
      traitTypes: traits.length,
      uniqueTraitValues: traits.reduce((sum, t) => sum + t.uniqueValues, 0),
      uniqueCombinations: combinations.size,
    },
    issues,
    ready: records.length > 0 && issues.every((i) => i.severity !== "error"),
  };
}

/* ------------------------------------------------------------------ */
/* storage                                                             */
/* ------------------------------------------------------------------ */

export interface ImportedAssetReference {
  tokenId: number;
  filename: string;
  mimeType: string;
  size: number;
  cid: string;
  imageCid: string;
  metadataCid: string;
  imageRootCid: string;
  metadataRootCid: string;
  imageUri: string;
  metadataUri: string;
}

export interface ImportedCollectionBundle {
  collectionImageCid: string;
  collectionImageUri: string;
  collectionMetadataCid: string;
  collectionMetadataUri: string;
  assetRootCids: string[];
  metadataRootCids: string[];
  assetRootUris: string[];
  metadataRootUris: string[];
  assetRootUri: string;
  metadataRootUri: string;
  items: ImportedAssetReference[];
}

export type UploadStage = "collection-image" | "images" | "metadata" | "done";

export interface UploadState {
  stage: UploadStage;
  completed: number;
  total: number;
  filename: string;
}

export interface UploadImportInput {
  name: string;
  symbol: string;
  description: string;
  creator: string;
  maxSupply: number;
  mintPrice: number;
  collectionImage: File;
  /** Uploaded NFT images keyed by their original filename. */
  imageFiles: Map<string, File>;
  nfts: ImportedNft[];
  /** Canvas size from the imported collection manifest. */
  width?: number | undefined;
  height?: number | undefined;
  /** Complete configured trait system from the imported manifest. */
  traits?: Record<string, CollectionTraitValue[]> | undefined;
}

/** Used when the imported manifest carried no canvas size. */
const DEFAULT_CANVAS = 512;

const toInput = async (file: File, filename = file.name): Promise<StorageFileInput> => ({
  filename,
  mimeType: file.type || mimeFromFilename(file.name),
  content: new Uint8Array(await file.arrayBuffer()),
});

/**
 * Always the registered provider — real IPFS uploads in the browser. Never
 * substitute a mock for large imports: a fake CID must never be persisted.
 */
function providerFor(_fileCount: number): StorageProvider {
  return getStorageProvider();
}

/**
 * Pins the imported package to (mock) IPFS.
 * The creator's metadata is stored VERBATIM apart from `image`, which is
 * rewritten to the pinned ipfs:// URI of the matching file.
 */
export async function uploadImportedCollection(
  input: UploadImportInput,
  onState?: (state: UploadState) => void,
): Promise<ImportedCollectionBundle> {
  const emit = (state: UploadState) => onState?.(state);
  const storage = providerFor(input.nfts.length);

  emit({ stage: "collection-image", completed: 0, total: 1, filename: input.collectionImage.name });
  const collectionImage = await storage.uploadFile(
    await toInput(input.collectionImage, collectionImageFilename(input.creator, input.symbol)),
    { pin: true },
  );

  // 1. Upload each imported batch into its own collision-safe directory.
  const ordered = [...input.nfts].sort((a, b) => a.tokenId - b.tokenId);
  const batches = new Map<string, ImportedNft[]>();
  for (const nft of ordered) {
    const segments = nft.sourceFile.split("/").filter(Boolean);
    const batchName = segments.length > 2 ? segments[0]! : "batch";
    batches.set(batchName, [...(batches.get(batchName) ?? []), nft]);
  }

  const imageByToken = new Map<number, StorageObject>();
  const metadataByToken = new Map<number, StorageObject>();
  const imageRoots: string[] = [];
  const metadataRoots: string[] = [];
  let completedImages = 0;
  let completedMetadata = 0;

  for (const [batchName, batchNfts] of batches) {
    const imageFiles: StorageFileInput[] = [];
    for (const nft of batchNfts) {
      const file = nft.matchedFilename ? input.imageFiles.get(nft.matchedFilename) : undefined;
      if (!file) throw new StorageError(`No image file for token #${nft.tokenId}`);
      imageFiles.push(await toInput(file));
    }
    const imagesDir = await storage.uploadDirectory(
      batchImagesNamespace(input.creator, input.symbol, batchName),
      imageFiles,
      {
        pin: true,
        onProgress: (p) =>
          emit({
            stage: "images",
            completed: completedImages + p.completed,
            total: ordered.length,
            filename: p.filename,
          }),
      },
    );
    if (imagesDir.entries.length !== imageFiles.length)
      throw new StorageError("Some images failed to pin — retry");
    imageRoots.push(imagesDir.uri);
    const imageEntries = new Map(imagesDir.entries.map((entry) => [entry.filename, entry]));
    for (const nft of batchNfts) {
      const entry = nft.matchedFilename ? imageEntries.get(nft.matchedFilename) : undefined;
      if (!entry) throw new StorageError(`No uploaded image reference for token #${nft.tokenId}`);
      imageByToken.set(nft.tokenId, entry);
    }
    completedImages += batchNfts.length;

    // 2. Preserve the matching metadata filename and replace its local image path
    // with that NFT's file-level `ipfs://<directory-cid>/<filename>` reference.
    const metadataFiles: StorageFileInput[] = batchNfts.map((nft) => {
      const image = imageByToken.get(nft.tokenId);
      if (!image) throw new StorageError(`No uploaded image reference for token #${nft.tokenId}`);
      return {
        filename: nft.sourceFile.split("/").pop() ?? `${nft.tokenId}.json`,
        mimeType: "application/json",
        content: JSON.stringify({ ...nft.raw, image: image.uri }, null, 2),
      };
    });
    const metadataDir = await storage.uploadDirectory(
      batchMetadataNamespace(input.creator, input.symbol, batchName),
      metadataFiles,
      {
        pin: true,
        onProgress: (p) =>
          emit({
            stage: "metadata",
            completed: completedMetadata + p.completed,
            total: ordered.length,
            filename: p.filename,
          }),
      },
    );
    metadataRoots.push(metadataDir.uri);
    const metadataEntries = new Map(metadataDir.entries.map((entry) => [entry.filename, entry]));
    for (const nft of batchNfts) {
      const filename = nft.sourceFile.split("/").pop() ?? `${nft.tokenId}.json`;
      const entry = metadataEntries.get(filename);
      if (!entry) throw new StorageError(`No uploaded metadata reference for token #${nft.tokenId}`);
      metadataByToken.set(nft.tokenId, entry);
    }
    completedMetadata += batchNfts.length;
  }

  // 3. Collection manifest: the COMPLETE self-contained description of the
  // collection — traits with weights plus every NFT's full metadata. No CID
  // references inside `nfts[]`, and no launch/application state.
  const collectionMetadata = await storage.uploadJson(
    collectionMetadataFilename(input.creator, input.symbol),
    buildCollectionManifest({
      name: input.name,
      description: input.description,
      width: input.width ?? DEFAULT_CANVAS,
      height: input.height ?? DEFAULT_CANVAS,
      traits: input.traits,
      nfts: ordered.map((nft) => ({
        name: nft.name,
        description: nft.description || input.description,
        image: nft.raw["image"] as string || nft.image,
        attributes: nft.attributes.map((attribute) => ({
          trait_type: attribute.trait_type,
          value: String(attribute.value),
        })),
      })),
    }),
    { pin: true },
  );

  emit({ stage: "done", completed: ordered.length, total: ordered.length, filename: "" });

  return {
    collectionImageCid: collectionImage.cid,
    collectionImageUri: collectionImage.uri,
    collectionMetadataCid: collectionMetadata.cid,
    collectionMetadataUri: collectionMetadata.uri,
    assetRootCids: imageRoots.map((uri) => uri.replace(/^ipfs:\/\//, "")),
    metadataRootCids: metadataRoots.map((uri) => uri.replace(/^ipfs:\/\//, "")),
    assetRootUris: imageRoots,
    metadataRootUris: metadataRoots,
    assetRootUri: imageRoots[0] ?? "",
    metadataRootUri: metadataRoots[0] ?? "",
    items: ordered.map((nft) => {
      const entry = imageByToken.get(nft.tokenId);
      const metadata = metadataByToken.get(nft.tokenId);
      if (!entry || !metadata) throw new StorageError(`Missing IPFS references for token #${nft.tokenId}`);
      return {
        tokenId: nft.tokenId,
        filename: entry.filename,
        mimeType: entry.mimeType,
        size: entry.size,
        cid: entry.cid,
        imageCid: entry.cid,
        metadataCid: metadata.cid,
        imageRootCid: entry.cid,
        metadataRootCid: metadata.cid,
        imageUri: entry.uri,
        metadataUri: metadata.uri,
      };
    }),
  };
}
