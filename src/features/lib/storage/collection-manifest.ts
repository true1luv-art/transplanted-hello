/**
 * Collection manifest — the ONE document pinned to IPFS for a collection.
 *
 * It is a complete, self-contained description of the generated collection:
 * name, description, canvas size, the full trait system (name + weight) and
 * the COMPLETE metadata of every NFT. No CID references inside `nfts[]`, and
 * no application/launch state (symbol, artwork, price, supply, dates, fees,
 * creator, chain ids) — those live in the local database.
 *
 * IPFS is immutable: whenever the manifest changes, a NEW complete document is
 * uploaded and the database stores the new `collection.metadataCid`.
 */
import {
  assertCollectionMetadataDocument,
  type CollectionMetadataDocument,
  type CollectionTraitValue,
  type NFTMetadataAttribute,
  type NFTMetadataDocument,
} from "@/features/lib/generator/metadata";

export type {
  CollectionMetadataDocument,
  CollectionTraitValue,
  NFTMetadataDocument,
} from "@/features/lib/generator/metadata";

export interface ManifestNftInput {
  name: string;
  description: string;
  image: string;
  attributes: NFTMetadataAttribute[];
}

export interface BuildManifestInput {
  name: string;
  description: string;
  width: number;
  height: number;
  /** Complete configured trait system. Derived from the NFTs when absent. */
  traits?: Record<string, CollectionTraitValue[]> | undefined;
  nfts: ManifestNftInput[];
}

const DEFAULT_WEIGHT = 50;

/**
 * Fallback trait system for imported collections whose manifest carried no
 * trait definitions: every observed value with its occurrence count as weight.
 */
export function traitsFromNfts(
  nfts: ManifestNftInput[],
): Record<string, CollectionTraitValue[]> {
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
): Record<string, CollectionTraitValue[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const traits: Record<string, CollectionTraitValue[]> = {};
  for (const [layer, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) continue;
    const values: CollectionTraitValue[] = [];
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

/** Builds and validates the complete manifest. */
export function buildCollectionManifest(
  input: BuildManifestInput,
): CollectionMetadataDocument {
  const nfts: NFTMetadataDocument[] = input.nfts.map((nft) => ({
    name: nft.name,
    description: nft.description,
    image: nft.image,
    attributes: nft.attributes.map((attribute) => ({
      trait_type: attribute.trait_type,
      value: attribute.value,
    })),
  }));

  const document: CollectionMetadataDocument = {
    name: input.name,
    description: input.description,
    width: input.width,
    height: input.height,
    traits: input.traits ?? traitsFromNfts(input.nfts),
    nfts,
  };
  assertCollectionMetadataDocument(document, input.nfts.length);
  return document;
}

/**
 * Adding NFTs to an existing collection: keeps the existing traits and the
 * existing `nfts[]`, appends the new NFT metadata, and returns a COMPLETE new
 * manifest ready to be pinned under a new CID.
 */
export function appendNftsToManifest(
  current: CollectionMetadataDocument,
  added: ManifestNftInput[],
): CollectionMetadataDocument {
  const existing = new Set(current.nfts.map((nft) => nft.name));
  const merged = [...current.nfts];
  for (const nft of added) {
    if (existing.has(nft.name)) continue;
    existing.add(nft.name);
    merged.push({
      name: nft.name,
      description: nft.description,
      image: nft.image,
      attributes: nft.attributes.map((attribute) => ({
        trait_type: attribute.trait_type,
        value: attribute.value,
      })),
    });
  }

  const document: CollectionMetadataDocument = { ...current, nfts: merged };
  assertCollectionMetadataDocument(document, merged.length);
  return document;
}
