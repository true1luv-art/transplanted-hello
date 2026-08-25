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
 * Generation recipe only: every layer with all of its available trait values.
 */
export interface CollectionMetadataDocument {
  name: string;
  description: string;
  width: number;
  height: number;
  traits: Record<string, CollectionTraitValue[]>;
}

export interface CollectionTraitValue {
  name: string;
  weight: number;
}

export function collectionMetadataDocument(
  settings: GeneratorSettings,
  layers: GeneratorLayer[],
): CollectionMetadataDocument {
  const traits: Record<string, CollectionTraitValue[]> = {};
  for (const layer of [...layers].sort((a, b) => a.order - b.order)) {
    traits[layer.name] = layer.traits.map((trait) => ({
      name: trait.name,
      weight: trait.weight,
    }));
  }

  return {
    name: settings.name,
    description: settings.description,
    width: settings.width,
    height: settings.height,
    traits,
  };
}

export function toJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}
