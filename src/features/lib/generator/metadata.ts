/**
 * Metadata documents produced by the studio.
 *
 * HiveX-specific, deliberately minimal. No NFTexport.io fields: no
 * `properties`, `compiler`, `external_url` or `dna`. Launch-owned
 * data (symbol, collection artwork, mint price, creator, CIDs, chain ids)
 * never appears here either.
 */
import {
  type GeneratedNFT,
  type GeneratorLayer,
  type GeneratorSettings,
} from "./types";

export interface NFTMetadataAttribute {
  trait_type: string;
  value: string;
}

export interface NFTMetadataDocument {
  name: string;
  description: string;
  /** Project-root path matching the batch ZIP's `images/` folder. */
  image: string;
  attributes: NFTMetadataAttribute[];
}

export function nftMetadataDocument(nft: GeneratedNFT): NFTMetadataDocument {
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

/**
 * COMPLETE collection manifest: the generation recipe (every layer with all of
 * its available trait values) PLUS the complete metadata of every generated
 * NFT. It is self-contained — the whole generated collection can be
 * reconstructed from it without the application database.
 *
 * It never contains launch/application state (symbol, artwork, price, supply,
 * dates, fees, creator, chain ids) and `nfts[]` never holds CID references.
 */
export interface CollectionMetadataDocument {
  name: string;
  description: string;
  width: number;
  height: number;
  traits: Record<string, CollectionTraitValue[]>;
  /** Complete metadata of every generated NFT — never an index of CIDs. */
  nfts: NFTMetadataDocument[];
}

export interface CollectionTraitValue {
  name: string;
  weight: number;
}

export function collectionTraitDefinitions(
  layers: GeneratorLayer[],
): Record<string, CollectionTraitValue[]> {
  const traits: Record<string, CollectionTraitValue[]> = {};
  for (const layer of [...layers].sort((a, b) => a.order - b.order)) {
    traits[layer.name] = layer.traits.map((trait) => ({
      name: trait.name,
      weight: trait.weight,
    }));
  }
  return traits;
}

export function collectionMetadataDocument(
  settings: GeneratorSettings,
  layers: GeneratorLayer[],
  nfts: GeneratedNFT[] = [],
): CollectionMetadataDocument {
  // The manifest and the individual NFT JSON files share ONE source object.
  const document: CollectionMetadataDocument = {
    name: settings.name,
    description: settings.description,
    width: settings.width,
    height: settings.height,
    traits: collectionTraitDefinitions(layers),
    nfts: nfts.map((nft) => nftMetadataDocument(nft)),
  };
  assertCollectionMetadataDocument(document, nfts.length);
  return document;
}

/**
 * Validates the manifest before it is exported or pinned. `expectedNftCount`
 * guards against silently omitting NFTs.
 */
export function assertCollectionMetadataDocument(
  document: CollectionMetadataDocument,
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
