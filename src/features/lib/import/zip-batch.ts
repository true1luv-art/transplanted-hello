/**
 * ZIP-based collection import.
 *
 * The creator uploads:
 *   A. one collection metadata archive     metadata.zip -> metadata/metadata.json
 *   B. one or more NFT batch archives      otters-1-100.zip -> otters-1-100/{images,metadata}
 *
 * Every batch belongs to the SAME collection. Each archive is inspected on its
 * own (images, metadata, matching, token ids), then all batches are combined and
 * the collection-wide report (traits, rarity, ranks, statistics) is calculated
 * across the ENTIRE collection.
 *
 * Nothing is generated: the NFT records already exist inside the archives.
 */
import { config } from "@/lib/config/config";
import { buildImportReport } from "./pipeline";
import { imageBasename, imageKey } from "./image-match";
import { parseMetadataFile } from "./parse";
import { resolveTokenIds } from "./token-id";
import { isSupportedImageName } from "./validate";
import {
  mockFileHash,
  readZip,
  rootFolderOf,
  textOf,
  zipBaseName,
  ZipReadError,
  type ZipEntry,
  type ZipSource,
} from "./zip";
import type { ImportIssue, ImportReport, ParsedMetadataRecord } from "./types";
import { normalizeTraitDefinitions } from "@/features/lib/metadata";
import type { TraitDefinition } from "@/features/lib/metadata";

/* ------------------------------------------------------------------ */
/* collection metadata archive                                         */
/* ------------------------------------------------------------------ */

export interface CollectionMetadataImport {
  zipName: string;
  /** Path of the located document, e.g. `metadata/metadata.json`. */
  sourceFile: string | null;
  /** Collection-level metadata, kept separate from NFT metadata. */
  metadata: Record<string, unknown> | null;
  name: string;
  symbol: string;
  description: string;
  image: string;
  externalUrl: string;
  /** Canvas size declared by the manifest. */
  width: number | null;
  height: number | null;
  /** Complete configured trait system declared by the manifest. */
  traits: Record<string, TraitDefinition[]> | undefined;
  issues: ImportIssue[];
  valid: boolean;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/** Locates and parses `metadata/metadata.json` inside the collection archive. */
export async function readCollectionMetadataZip(
  source: ZipSource,
): Promise<CollectionMetadataImport> {
  const empty = (issues: ImportIssue[]): CollectionMetadataImport => ({
    zipName: source.name,
    sourceFile: null,
    metadata: null,
    name: "",
    symbol: "",
    description: "",
    image: "",
    externalUrl: "",
    width: null,
    height: null,
    traits: undefined,
    issues,
    valid: false,
  });

  let entries: ZipEntry[];
  try {
    entries = await readZip(source);
  } catch (error) {
    return empty([
      {
        code: "ZIP_READ",
        severity: "error",
        subject: source.name,
        message: error instanceof ZipReadError ? error.message : "Archive could not be opened",
      },
    ]);
  }

  const entry =
    entries.find((e) => /(^|\/)metadata\/metadata\.json$/i.test(e.path)) ??
    entries.find((e) => /(^|\/)metadata\.json$/i.test(e.path)) ??
    entries.find((e) => /\.json$/i.test(e.path));

  if (!entry) {
    return empty([
      {
        code: "ZIP_STRUCTURE",
        severity: "error",
        subject: source.name,
        message: "No metadata/metadata.json found in the collection metadata archive",
      },
    ]);
  }

  let doc: unknown;
  try {
    doc = JSON.parse(textOf(entry));
  } catch (error) {
    return empty([
      {
        code: "JSON_SYNTAX",
        severity: "error",
        subject: entry.path,
        message: `Invalid JSON: ${error instanceof Error ? error.message : "parse error"}`,
      },
    ]);
  }

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return empty([
      {
        code: "COLLECTION_METADATA",
        severity: "error",
        subject: entry.path,
        message: "Collection metadata must be a JSON object",
      },
    ]);
  }

  const record = doc as Record<string, unknown>;
  const issues: ImportIssue[] = [];
  const name = str(record["name"] ?? record["collection"]);
  if (!name) {
    issues.push({
      code: "COLLECTION_METADATA",
      severity: "warning",
      subject: entry.path,
      message: "Collection metadata has no name — the form value is used instead",
    });
  }

  return {
    zipName: source.name,
    sourceFile: entry.path,
    metadata: record,
    name,
    // Symbol is launch-owned and must come from the Create Collection form.
    symbol: "",
    description: str(record["description"]),
    image: str(record["image"] ?? record["image_url"] ?? record["banner"]),
    externalUrl: str(record["external_url"] ?? record["externalUrl"]),
    width: num(record["width"]),
    height: num(record["height"]),
    traits: normalizeTraitDefinitions(record["traits"]),
    issues,
    valid: true,
  };
}

/* ------------------------------------------------------------------ */
/* NFT batch archives                                                  */
/* ------------------------------------------------------------------ */

export interface BatchImage {
  filename: string;
  /** Deterministic mock content hash — used for duplicate artwork detection. */
  hash: string;
  entry: ZipEntry;
}

export interface BatchImportResult {
  zipName: string;
  /** Root folder inside the archive (the batch name). */
  batchName: string;
  imageCount: number;
  metadataCount: number;
  matchedCount: number;
  /** Metadata records whose referenced image is not in the archive. */
  missingImages: string[];
  /** Images in the archive that no metadata references. */
  orphanImages: string[];
  invalidMetadata: number;
  tokenIds: number[];
  /** Token ids repeated inside this batch. */
  duplicateTokenIds: number[];
  records: ParsedMetadataRecord[];
  images: BatchImage[];
  issues: ImportIssue[];
  valid: boolean;
}

const isJson = (path: string) => /\.json$/i.test(path);
const inFolder = (path: string, folder: string) => new RegExp(`(^|/)${folder}/`, "i").test(path);

/**
 * Inspects one NFT batch archive: structure, images, metadata, matching and
 * token ids. Files are not stored — validation comes first.
 */
export async function inspectNftBatch(source: ZipSource): Promise<BatchImportResult> {
  const base: BatchImportResult = {
    zipName: source.name,
    batchName: zipBaseName(source.name),
    imageCount: 0,
    metadataCount: 0,
    matchedCount: 0,
    missingImages: [],
    orphanImages: [],
    invalidMetadata: 0,
    tokenIds: [],
    duplicateTokenIds: [],
    records: [],
    images: [],
    issues: [],
    valid: false,
  };

  let entries: ZipEntry[];
  try {
    entries = await readZip(source);
  } catch (error) {
    return {
      ...base,
      issues: [
        {
          code: "ZIP_READ",
          severity: "error",
          subject: source.name,
          message: error instanceof ZipReadError ? error.message : "Archive could not be opened",
        },
      ],
    };
  }

  const issues: ImportIssue[] = [];
  const root = rootFolderOf(entries);
  const batchName = root ?? zipBaseName(source.name);

  // images/ and metadata/ folders, with a lenient fallback to file types.
  const imageEntries = entries.filter((e) => inFolder(e.path, "images") && !isJson(e.path));
  const metadataEntries = entries.filter((e) => inFolder(e.path, "metadata") && isJson(e.path));
  const images = imageEntries.length
    ? imageEntries
    : entries.filter((e) => isSupportedImageName(e.name));
  const metadata = metadataEntries.length ? metadataEntries : entries.filter((e) => isJson(e.path));

  if (!imageEntries.length || !metadataEntries.length) {
    issues.push({
      code: "ZIP_STRUCTURE",
      severity: "warning",
      subject: source.name,
      message: `Expected ${batchName}/images/ and ${batchName}/metadata/ — falling back to file types`,
    });
  }
  if (!images.length) {
    issues.push({
      code: "NO_IMAGES",
      severity: "error",
      subject: source.name,
      message: "Archive contains no images",
    });
  }
  if (!metadata.length) {
    issues.push({
      code: "NO_METADATA",
      severity: "error",
      subject: source.name,
      message: "Archive contains no NFT metadata JSON",
    });
  }

  // Unsupported image formats.
  const supported: BatchImage[] = [];
  for (const entry of images) {
    if (!isSupportedImageName(entry.name)) {
      issues.push({
        code: "UNSUPPORTED_IMAGE",
        severity: "error",
        subject: entry.path,
        message: `Unsupported image format (allowed: ${config.storage.supportedExtensions.join(", ")})`,
      });
      continue;
    }
    supported.push({ filename: entry.name, hash: mockFileHash(entry.bytes), entry });
  }

  // Parse each per-token metadata document.
  const records: ParsedMetadataRecord[] = [];
  let invalidMetadata = 0;
  for (const entry of metadata) {
    const parsed = parseMetadataFile(entry.path, textOf(entry));
    if (!parsed.records.length) invalidMetadata += 1;
    records.push(...parsed.records);
    issues.push(...parsed.issues);
  }

  // Filename matching — exact filenames first, never array order.
  const byFilename = new Map<string, BatchImage>();
  for (const image of supported) {
    const key = imageKey(image.filename);
    if (byFilename.has(image.filename) || (byFilename.has(key) && key !== image.filename)) {
      issues.push({
        code: "DUPLICATE_IMAGE_FILE",
        severity: "warning",
        subject: image.entry.path,
        message: "Two images share the same filename",
      });
      continue;
    }
    byFilename.set(image.filename, image);
    if (!byFilename.has(key)) byFilename.set(key, image);
  }

  const usedImages = new Set<string>();
  const missingImages: string[] = [];
  for (const record of records) {
    const reference = imageBasename(record.image ?? "");
    const image = reference
      ? (byFilename.get(reference) ?? byFilename.get(imageKey(reference)))
      : undefined;
    if (image) usedImages.add(image.filename);
    else missingImages.push(record.image || record.name || record.sourceFile);
  }
  const orphanImages = supported.filter((i) => !usedImages.has(i.filename)).map((i) => i.filename);

  for (const subject of missingImages.slice(0, 5)) {
    issues.push({
      code: "MISSING_IMAGE",
      severity: "error",
      subject,
      message: "Referenced image is not in the archive",
    });
  }
  if (missingImages.length > 5) {
    issues.push({
      code: "MISSING_IMAGE",
      severity: "error",
      message: `…and ${missingImages.length - 5} more missing images`,
      count: missingImages.length - 5,
    });
  }
  for (const subject of orphanImages.slice(0, 5)) {
    issues.push({
      code: "ORPHAN_IMAGE",
      severity: "warning",
      subject,
      message: "Image is not referenced by any metadata",
    });
  }

  // Token ids from the metadata, unique inside the batch.
  const tokenIds = resolveTokenIds(records, { useImportOrder: false }).map((t) => t.tokenId);
  const seen = new Set<number>();
  const duplicateTokenIds: number[] = [];
  tokenIds.forEach((tokenId, index) => {
    if (tokenId === null) {
      issues.push({
        code: "TOKEN_ID_UNRESOLVED",
        severity: "error",
        subject: records[index]?.name ?? `${source.name}[${index}]`,
        message: "Could not read a token number from this metadata",
      });
      return;
    }
    if (seen.has(tokenId)) {
      duplicateTokenIds.push(tokenId);
      issues.push({
        code: "DUPLICATE_TOKEN_ID",
        severity: "error",
        subject: `#${tokenId}`,
        message: `Duplicate token ID ${tokenId} inside ${source.name}`,
      });
    }
    seen.add(tokenId);
  });

  const resolved = tokenIds.filter((t): t is number => t !== null);

  // Launch requires a strict 1:1 pairing between images/ and metadata/.
  if (supported.length && records.length && supported.length !== records.length) {
    issues.push({
      code: "COUNT_MISMATCH",
      severity: "error",
      subject: source.name,
      message: `Archive has ${supported.length} image(s) but ${records.length} metadata document(s) — they must match 1:1`,
    });
  }

  return {
    zipName: source.name,
    batchName,
    imageCount: supported.length,
    metadataCount: records.length,
    matchedCount: records.length - missingImages.length,
    missingImages,
    orphanImages,
    invalidMetadata,
    tokenIds: resolved,
    duplicateTokenIds,
    records,
    images: supported,
    issues,
    valid: images.length > 0 && records.length > 0 && issues.every((i) => i.severity !== "error"),
  };
}

/* ------------------------------------------------------------------ */
/* whole-package import                                                */
/* ------------------------------------------------------------------ */

export interface ImportProgress {
  /** Archive currently being processed. */
  zipName: string;
  /** 1-based position in the queue. */
  index: number;
  total: number;
  phase: "collection" | "batch" | "analysing" | "done";
  /** 0-100 */
  percent: number;
}

export interface DuplicateArtwork {
  hash: string;
  filenames: string[];
}

export interface ZipImportResult {
  collection: CollectionMetadataImport | null;
  batches: BatchImportResult[];
  /** Collection-wide report: traits, rarity scores, ranks and statistics. */
  report: ImportReport;
  /** Images by filename, ready for the (mock) IPFS pipeline. */
  images: BatchImage[];
  /** Token ids that appear in more than one batch. */
  crossBatchDuplicateTokenIds: number[];
  /** Identical artwork under different filenames (warning only). */
  duplicateArtwork: DuplicateArtwork[];
}

export interface ImportZipPackageInput {
  collectionZip?: ZipSource | undefined;
  batchZips: ZipSource[];
  /** Defaults to the imported metadata count. */
  maxSupply?: number | undefined;
  onProgress?: ((progress: ImportProgress) => void) | undefined;
}

/**
 * Imports the whole ZIP package: collection metadata archive + every NFT batch.
 * Rarity is calculated once, across the combined collection.
 */
export async function importZipPackage(input: ImportZipPackageInput): Promise<ZipImportResult> {
  const { batchZips, onProgress } = input;
  const total = batchZips.length + (input.collectionZip ? 1 : 0);
  let step = 0;
  const emit = (zipName: string, phase: ImportProgress["phase"]) => {
    onProgress?.({
      zipName,
      index: Math.min(step, total),
      total,
      phase,
      percent: total ? Math.round((step / total) * 100) : 100,
    });
  };

  let collection: CollectionMetadataImport | null = null;
  if (input.collectionZip) {
    emit(input.collectionZip.name, "collection");
    collection = await readCollectionMetadataZip(input.collectionZip);
    step += 1;
    emit(input.collectionZip.name, "collection");
  }

  const batches: BatchImportResult[] = [];
  for (const zip of batchZips) {
    emit(zip.name, "batch");
    batches.push(await inspectNftBatch(zip));
    step += 1;
    emit(zip.name, "batch");
    // Yield to the event loop so the UI keeps painting between archives.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  emit("", "analysing");

  // Combine every batch into one collection.
  const records: ParsedMetadataRecord[] = [];
  const images: BatchImage[] = [];
  const imageByName = new Map<string, BatchImage>();
  const extraIssues: ImportIssue[] = [...(collection?.issues ?? [])];

  for (const batch of batches) {
    records.push(...batch.records);
    for (const image of batch.images) {
      const existing = imageByName.get(image.filename);
      if (existing) {
        if (existing.hash !== image.hash) {
          extraIssues.push({
            code: "DUPLICATE_IMAGE_FILE",
            severity: "error",
            subject: image.filename,
            message: `Different images share the filename ${image.filename} across batches`,
          });
        }
        continue;
      }
      imageByName.set(image.filename, image);
      images.push(image);
    }
    extraIssues.push(
      ...batch.issues.filter((i) => i.code !== "MISSING_IMAGE" && i.code !== "ORPHAN_IMAGE"),
    );
  }

  // Cross-batch duplicate token ids.
  const owner = new Map<number, string>();
  const crossBatchDuplicateTokenIds: number[] = [];
  for (const batch of batches) {
    for (const tokenId of batch.tokenIds) {
      const first = owner.get(tokenId);
      if (first && first !== batch.batchName) {
        crossBatchDuplicateTokenIds.push(tokenId);
        extraIssues.push({
          code: "DUPLICATE_TOKEN_ID",
          severity: "error",
          subject: `#${tokenId}`,
          message: `Duplicate token ID ${tokenId} in ${batch.batchName} (already in ${first})`,
        });
      } else if (!first) {
        owner.set(tokenId, batch.batchName);
      }
    }
  }

  // Identical artwork under different filenames — a warning, never a rejection.
  const byHash = new Map<string, string[]>();
  for (const image of images) {
    const bucket = byHash.get(image.hash) ?? [];
    bucket.push(image.filename);
    byHash.set(image.hash, bucket);
  }
  const duplicateArtwork: DuplicateArtwork[] = [];
  for (const [hash, filenames] of byHash) {
    if (filenames.length < 2) continue;
    duplicateArtwork.push({ hash, filenames });
    extraIssues.push({
      code: "DUPLICATE_IMAGE_HASH",
      severity: "warning",
      subject: filenames.slice(0, 3).join(", "),
      message: "Identical artwork found under different filenames",
    });
  }

  const report = buildImportReport({
    records,
    images: images.map((i) => ({ name: i.filename })),
    maxSupply: input.maxSupply ?? records.length,
    parseIssues: extraIssues,
    useImportOrder: false,
  });

  step = total;
  emit("", "done");

  return { collection, batches, report, images, crossBatchDuplicateTokenIds, duplicateArtwork };
}
