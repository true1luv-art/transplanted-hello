/**
 * THE canonical metadata module.
 *
 * One definition of every metadata concept in the application:
 *
 *   NFTAttribute      { trait_type, value }
 *   NFTMetadata       { name, description, image, attributes }
 *   TraitDefinition   { name, weight }
 *   CollectionMetadata{ name, description, width, height, traits, nfts }
 *
 * The generator produces `NFTMetadata` once and every other system —
 * individual JSON files, the collection manifest, the ZIP export, the IPFS
 * upload and the Hive mint payload — consumes that same object.
 *
 * `CollectionMetadata` is a COMPLETE, self-contained manifest: the full trait
 * system (name + weight) plus the complete metadata of every NFT. It never
 * contains CID references inside `nfts[]`, and never contains launch or
 * application state (symbol, cover artwork, supply, price, dates, fees,
 * creator, chain ids) — that lives in the database.
 */
import type { GeneratedNFT, GeneratorLayer, GeneratorSettings } from "./generator/types";

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  /** `images/<file>` while local; an `ipfs://…` URI once uploaded. */
  image: string;
  attributes: NFTAttribute[];
}

export interface TraitDefinition {
  name: string;
  weight: number;
}

export interface CollectionMetadata {
  name: string;
  description: string;
  width: number;
  height: number;
  traits: Record<string, TraitDefinition[]>;
  /** Complete metadata of every NFT — never an index of CIDs. */
  nfts: NFTMetadata[];
}

const DEFAULT_WEIGHT = 50;

/** The generator's single source of truth for one NFT. */
export function toNftMetadata(nft: GeneratedNFT): NFTMetadata {
  return {
    name: nft.name,
    description: nft.description,
    image: nft.imageReference,
    attributes: nft.traits.map((trait) => ({
      trait_type: trait.layerName,
      value: trait.traitName,
    })),
  };
}

/** Copies an NFT metadata document, dropping anything that is not canonical. */
export function cloneNftMetadata(nft: NFTMetadata): NFTMetadata {
  return {
    name: nft.name,
    description: nft.description,
    image: nft.image,
    attributes: nft.attributes.map((attribute) => ({
      trait_type: attribute.trait_type,
      value: attribute.value,
    })),
  };
}

/** Complete configured trait system, in composition order. */
export function traitDefinitionsFromLayers(
  layers: GeneratorLayer[],
): Record<string, TraitDefinition[]> {
  const traits: Record<string, TraitDefinition[]> = {};
  for (const layer of [...layers].sort((a, b) => a.order - b.order)) {
    traits[layer.name] = layer.traits.map((trait) => ({
      name: trait.name,
      weight: trait.weight,
    }));
  }
  return traits;
}

/** Trait system derived from observed NFT attributes (imported collections). */
export function traitDefinitionsFromNfts(nfts: NFTMetadata[]): Record<string, TraitDefinition[]> {
  const traits: Record<string, Map<string, number>> = {};
  for (const nft of nfts) {
    for (const attribute of nft.attributes) {
      const layer = (traits[attribute.trait_type] ??= new Map());
      layer.set(attribute.value, (layer.get(attribute.value) ?? 0) + 1);
    }
  }
  return Object.fromEntries(
    Object.entries(traits).map(([layer, values]) => [
      layer,
      [...values.entries()].map(([name, weight]) => ({ name, weight })),
    ]),
  );
}

/** Normalises loosely-typed trait definitions read back from a manifest. */
export function normalizeTraitDefinitions(
  value: unknown,
): Record<string, TraitDefinition[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const traits: Record<string, TraitDefinition[]> = {};
  for (const [layer, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) continue;
    const values: TraitDefinition[] = [];
    for (const entry of raw) {
      if (typeof entry === "string") {
        values.push({ name: entry, weight: DEFAULT_WEIGHT });
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const name = typeof record["name"] === "string" ? record["name"] : "";
      if (!name.trim()) continue;
      const weight = typeof record["weight"] === "number" ? record["weight"] : DEFAULT_WEIGHT;
      values.push({ name, weight });
    }
    if (values.length) traits[layer] = values;
  }
  return Object.keys(traits).length ? traits : undefined;
}

export interface BuildCollectionMetadataInput {
  name: string;
  description: string;
  width: number;
  height: number;
  /** Complete configured trait system. Derived from the NFTs when absent. */
  traits?: Record<string, TraitDefinition[]> | undefined;
  nfts: NFTMetadata[];
}

/** Builds and validates the complete collection manifest. */
export function buildCollectionMetadata(
  input: BuildCollectionMetadataInput,
): CollectionMetadata {
  const nfts = input.nfts.map(cloneNftMetadata);
  const document: CollectionMetadata = {
    name: input.name,
    description: input.description,
    width: input.width,
    height: input.height,
    traits: input.traits ?? traitDefinitionsFromNfts(nfts),
    nfts,
  };
  assertCollectionMetadata(document, nfts.length);
  return document;
}

/** The generator's manifest: configured trait system + every generated NFT. */
export function collectionMetadataFromProject(
  settings: GeneratorSettings,
  layers: GeneratorLayer[],
  nfts: GeneratedNFT[] = [],
): CollectionMetadata {
  return buildCollectionMetadata({
    name: settings.name,
    description: settings.description,
    width: settings.width,
    height: settings.height,
    traits: traitDefinitionsFromLayers(layers),
    nfts: nfts.map(toNftMetadata),
  });
}

/**
 * Adding NFTs to an existing collection: keeps the existing traits and NFTs,
 * appends the new ones and returns a COMPLETE new manifest to pin under a new
 * CID. IPFS objects are immutable — nothing is ever mutated in place.
 */
export function appendNfts(
  current: CollectionMetadata,
  added: NFTMetadata[],
): CollectionMetadata {
  const names = new Set(current.nfts.map((nft) => nft.name));
  const merged = current.nfts.map(cloneNftMetadata);
  for (const nft of added) {
    if (names.has(nft.name)) continue;
    names.add(nft.name);
    merged.push(cloneNftMetadata(nft));
  }
  const document: CollectionMetadata = { ...current, nfts: merged };
  assertCollectionMetadata(document, merged.length);
  return document;
}

/**
 * Strict validation before export or upload. Malformed metadata is never
 * silently repaired — the caller gets a useful error instead.
 */
export function assertCollectionMetadata(
  document: CollectionMetadata,
  expectedNftCount?: number,
): void {
  const fail = (message: string): never => {
    throw new Error(`Invalid collection metadata: ${message}`);
  };
  if (!document.name?.trim()) fail("collection name is missing");
  if (!document.description?.trim()) fail("collection description is missing");
  if (!Number.isFinite(document.width) || document.width <= 0) fail("width is missing");
  if (!Number.isFinite(document.height) || document.height <= 0) fail("height is missing");
  if (!document.traits || typeof document.traits !== "object") fail("traits are missing");

  for (const [layer, values] of Object.entries(document.traits)) {
    if (!Array.isArray(values)) fail(`trait "${layer}" is not a list`);
    for (const value of values) {
      if (!value?.name?.trim()) fail(`a trait value of "${layer}" has no name`);
      if (!Number.isFinite(value.weight)) fail(`trait "${layer}/${value.name}" has no weight`);
    }
  }

  if (!Array.isArray(document.nfts)) fail("nfts array is missing");
  if (expectedNftCount !== undefined && document.nfts.length !== expectedNftCount) {
    fail(`nfts contains ${document.nfts.length} items but ${expectedNftCount} were generated`);
  }
  for (const nft of document.nfts) {
    if (!nft?.name?.trim()) fail("an NFT has no name");
    if (!nft.description?.trim()) fail(`NFT "${nft.name}" has no description`);
    if (!nft.image?.trim()) fail(`NFT "${nft.name}" has no image`);
    if ("metadata" in nft || "metadataCid" in nft) {
      fail(`NFT "${nft.name}" must contain its complete metadata, not a CID reference`);
    }
    if (!Array.isArray(nft.attributes)) fail(`NFT "${nft.name}" has no attributes`);
    for (const attribute of nft.attributes) {
      if (!attribute?.trait_type?.trim()) fail(`NFT "${nft.name}" has an attribute without trait_type`);
      if (!String(attribute?.value ?? "").trim())
        fail(`NFT "${nft.name}" has an attribute without a value`);
    }
  }
}

export function toJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}
