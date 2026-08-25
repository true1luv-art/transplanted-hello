/**
 * Deterministic filenames for generated output.
 *
 * The export layout mirrors what the importer already understands:
 *   metadata.zip                -> metadata/metadata.json
 *   <slug>-<from>-<to>.zip      -> <slug>-<from>-<to>/{images,metadata}/…
 */
import type { GeneratorSettings } from "./types";

/** URL/file safe slug: lowercase, dashes, no repeats. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "collection"
  );
}

export function collectionSlug(settings: GeneratorSettings): string {
  return slugify(settings.name);
}

/** Symbol is derived from the collection name — users never type one. */
export function deriveSymbol(name: string): string {
  const words = name
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return "COLL";
  const letters = words.length > 1 ? words.map((word) => word[0]!).join("") : words[0]!.slice(0, 4);
  return letters.toUpperCase().slice(0, 6);
}

/**
 * Filename prefix — the configured Item Name Prefix is the source of truth.
 * `Otters Outbreak #` -> `otters-outbreak-#`. Falls back to the collection
 * slug when no prefix is configured.
 */
export function filePrefix(settings: GeneratorSettings): string {
  const raw = settings.itemPrefix?.trim();
  if (!raw) return `${collectionSlug(settings)}-#`;
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9#]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  if (!cleaned) return `${collectionSlug(settings)}-#`;
  // A prefix without an explicit `#` still gets one so numbers stay readable:
  // `Ember Sentinel` -> `ember-sentinel-#1.png`.
  return cleaned.endsWith("#") ? cleaned : `${cleaned}-#`;
}

/** `otters-outbreak-#42.png` — driven by the configured Item Name Prefix. */
export function imageFilenameFor(settings: GeneratorSettings, tokenId: number): string {
  return `${filePrefix(settings)}${tokenId}.png`;
}

/** `otters-outbreak-#42.json` — matches its image basename exactly. */
export function metadataFilenameFor(settings: GeneratorSettings, tokenId: number): string {
  return `${filePrefix(settings)}${tokenId}.json`;
}

/**
 * Project-root image reference stored inside an NFT metadata document.
 * Replaced with a real IPFS URI during launch.
 */
export function imageReferenceFor(settings: GeneratorSettings, tokenId: number): string {
  return `images/${imageFilenameFor(settings, tokenId)}`;
}

/** `otters-outbreak-1-100` — batch folder + archive base name. */
export function batchNameFor(settings: GeneratorSettings, from: number, to: number): string {
  return `${collectionSlug(settings)}-${from}-${to}`;
}

/**
 * Item display name from the prefix:
 *   `Otters`  -> `Otters 1`
 *   `Otters #`-> `Otters #1`
 *   `Otters#` -> `Otters#1`
 */
export function itemNameFor(settings: GeneratorSettings, tokenId: number): string {
  const raw = settings.itemPrefix?.trim() ? settings.itemPrefix : settings.name;
  const prefix = raw.replace(/\s+$/, "");
  if (!prefix) return `#${tokenId}`;
  return prefix.endsWith("#") ? `${prefix}${tokenId}` : `${prefix} ${tokenId}`;
}

/* ------------------------------------------------------------------ *
 * IPFS namespaces
 *
 * Every collection owns two upload namespaces plus one collection document:
 *   <user>-<symbol>-images/<file>.png
 *   <user>-<symbol>-metadata/<NFTMintId>.json
 *   <user>-<symbol>-collection.json   (+ -collection.png artwork)
 * ------------------------------------------------------------------ */

/** `rhiaji-otbk` — the shared prefix of every namespace of one collection. */
export function ipfsNamespace(user: string, symbol: string): string {
  return `${slugify(user)}-${slugify(symbol)}`;
}

export const imagesNamespace = (user: string, symbol: string): string =>
  `${ipfsNamespace(user, symbol)}-images`;

export const metadataNamespace = (user: string, symbol: string): string =>
  `${ipfsNamespace(user, symbol)}-metadata`;

/** Batch-aware namespace used when launch imports an exported ZIP batch. */
export const batchImagesNamespace = (user: string, symbol: string, batch: string): string =>
  `${ipfsNamespace(user, symbol)}-${slugify(batch)}-images`;

/** Batch-aware namespace used when launch imports an exported ZIP batch. */
export const batchMetadataNamespace = (user: string, symbol: string, batch: string): string =>
  `${ipfsNamespace(user, symbol)}-${slugify(batch)}-metadata`;

export const collectionMetadataFilename = (user: string, symbol: string): string =>
  `${ipfsNamespace(user, symbol)}-collection.json`;

export const collectionImageFilename = (user: string, symbol: string): string =>
  `${ipfsNamespace(user, symbol)}-collection.png`;

/** Namespaced path of one NFT image inside the images namespace. */
export const namespacedImagePath = (user: string, symbol: string, filename: string): string =>
  `${imagesNamespace(user, symbol)}/${filename}`;

/** Namespaced path of one NFT metadata document — always `<NFTMintId>.json`. */
export const namespacedMetadataPath = (user: string, symbol: string, NFTMintId: number): string =>
  `${metadataNamespace(user, symbol)}/${NFTMintId}.json`;
