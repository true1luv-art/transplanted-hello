/**
 * ZIP export. Produces exactly the layout the HiveMint importer expects:
 *
 *   metadata.zip                 -> metadata/metadata.json
 *   <slug>-1-100.zip             -> <slug>-1-100/images/*.png
 *                                   <slug>-1-100/metadata/*.json
 *   <slug>-export.zip            -> all of the above in one archive
 *
 * Pure and Node-safe: bytes in, bytes out.
 */
import { zipSync, type Zippable } from "fflate";
import { splitBatches, BATCH_SIZE } from "./batching";
import { collectionMetadataDocument, nftMetadataDocument, toJsonBytes } from "./metadata";
import { collectionSlug } from "./naming";
import type {
  ExportBatch,
  ExportFile,
  GeneratedNFT,
  GeneratorLayer,
  GeneratorSettings,
} from "./types";

const zip = (tree: Zippable): Uint8Array => zipSync(tree, { level: 6 });

export const COLLECTION_ARCHIVE_NAME = "metadata.zip";

/** metadata.zip — the complete collection manifest (traits + every NFT). */
export function buildCollectionArchive(
  settings: GeneratorSettings,
  layers: GeneratorLayer[],
  nfts: GeneratedNFT[],
): ExportFile {
  const bytes = zip({
    metadata: {
      "metadata.json": toJsonBytes(collectionMetadataDocument(settings, layers, nfts)),
    },
  });
  return { filename: COLLECTION_ARCHIVE_NAME, bytes, count: 0, kind: "collection" };
}

/** One batch archive of at most 100 NFTs (images + metadata). */
export function buildBatchArchive(
  batch: ExportBatch,
  nfts: GeneratedNFT[],
  images: Map<number, Uint8Array>,
): ExportFile {
  const byToken = new Map(nfts.map((nft) => [nft.tokenId, nft]));
  const imageFolder: Record<string, Uint8Array> = {};
  const metadataFolder: Record<string, Uint8Array> = {};

  for (const tokenId of batch.tokenIds) {
    const nft = byToken.get(tokenId);
    if (!nft) throw new Error(`Missing generated NFT #${tokenId}`);
    metadataFolder[nft.metadataFilename] = toJsonBytes(nftMetadataDocument(nft));
    const image = images.get(tokenId);
    if (!image) throw new Error(`Missing exported image for NFT #${tokenId}`);
    imageFolder[nft.imageFilename] = image;
  }

  if (
    Object.keys(imageFolder).length !== batch.tokenIds.length ||
    Object.keys(metadataFolder).length !== batch.tokenIds.length
  ) {
    throw new Error(`Batch ${batch.name} does not contain a matching image and metadata file for every NFT`);
  }

  const bytes = zip({ [batch.name]: { images: imageFolder, metadata: metadataFolder } });
  return { filename: `${batch.name}.zip`, bytes, count: batch.tokenIds.length, kind: "batch" };
}

/** Outer bundle containing metadata.zip plus every batch archive. */
export function buildBundleArchive(
  settings: GeneratorSettings,
  files: ExportFile[],
  count: number,
): ExportFile {
  const tree: Zippable = {};
  for (const file of files) tree[file.filename] = file.bytes;
  return {
    filename: `${collectionSlug(settings)}-export.zip`,
    bytes: zip(tree),
    count,
    kind: "bundle",
  };
}

export interface ExportPackage {
  collection: ExportFile;
  batches: ExportFile[];
  bundle: ExportFile;
  batchPlan: ExportBatch[];
}

/** Builds metadata.zip, every batch archive, and the single outer bundle. */
export function buildExportPackage(options: {
  settings: GeneratorSettings;
  nfts: GeneratedNFT[];
  images: Map<number, Uint8Array>;
  layers: GeneratorLayer[];
  batchSize?: number;
}): ExportPackage {
  const { settings, nfts, images, layers } = options;
  const batchPlan = splitBatches(nfts, settings, options.batchSize ?? BATCH_SIZE);
  const collection = buildCollectionArchive(settings, layers, nfts);
  const batches = batchPlan.map((batch) => buildBatchArchive(batch, nfts, images));

  const tree: Zippable = { [collection.filename]: collection.bytes };
  for (const file of batches) tree[file.filename] = file.bytes;

  const bundle: ExportFile = {
    filename: `${collectionSlug(settings)}-export.zip`,
    bytes: zip(tree),
    count: nfts.length,
    kind: "bundle",
  };

  return { collection, batches, bundle, batchPlan };
}

/** Browser download helper. */
export function downloadExportFile(file: ExportFile): void {
  const blob = new Blob([file.bytes as unknown as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
