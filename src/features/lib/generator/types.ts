/**
 * HiveMint NFT Generation Studio — types.
 *
 * The generator is a LOCAL creator tool: layers -> weighted random ->
 * unique DNA -> composited PNG -> per-NFT metadata -> batched ZIP export.
 * Nothing here touches the blockchain, IPFS or the API.
 */

export interface GeneratorTrait {
  id: string;
  layerId: string;
  /** Original upload filename, e.g. `blue.png`. */
  filename: string;
  /** Display name used in metadata attributes, e.g. `Blue`. */
  name: string;
  /** Relative weight. Weights never have to sum to 100. Zero is never picked. */
  weight: number;
  enabled: boolean;
  /** Object URL / data URI for preview + canvas composition (browser only). */
  src: string;
}

export interface GeneratorLayer {
  id: string;
  name: string;
  enabled: boolean;
  /** Composition order, ascending: lowest renders first (bottom). */
  order: number;
  traits: GeneratorTrait[];
}

export interface GeneratorSettings {
  name: string;
  description: string;
  /** Item name prefix, e.g. `Otters` -> `Otters 1`, `Otters #` -> `Otters #1`. Falls back to name. */
  itemPrefix: string;
  supply: number;
  /** Output width in px. */
  width: number;
  /** Output height in px. */
  height: number;
}

/** Maximum collection size. Export archives are independently capped at 100 NFTs. */
export const MAX_COLLECTION_SIZE = 10_000;

/** Output artwork bounds, in px. Applies to width and height alike. */
export const MIN_DIMENSION = 512;
export const MAX_DIMENSION = 2048;

/** Item numbering starts at 1. This is a display number, never a blockchain id. */
export const FIRST_ITEM_NUMBER = 1;

export interface GeneratorProject {
  settings: GeneratorSettings;
  layers: GeneratorLayer[];
}

export interface GeneratedTraitRef {
  layerId: string;
  layerName: string;
  traitId: string;
  traitName: string;
  weight: number;
  /** Configured probability inside its layer (0-1) — a generation weight, not a rarity tier. */
  probability: number;
}

export interface GeneratedNFT {
  tokenId: number;
  name: string;
  description: string;
  dna: string;
  traits: GeneratedTraitRef[];
  imageFilename: string;
  metadataFilename: string;
  /** `images/<imageFilename>` — replaced with a real IPFS URI at launch. */
  imageReference: string;
  /** Object URL of the composited PNG (browser only). */
  previewUrl?: string | undefined;
  /** Object URL of a downscaled preview used by the grid (browser only). */
  thumbnailUrl?: string | undefined;
}

export interface TraitDistributionRow {
  layerId: string;
  layerName: string;
  traitId: string;
  traitName: string;
  weight: number;
  /** Configured share (0-1). */
  expected: number;
  /** Observed share (0-1). */
  actual: number;
  count: number;
}

export interface GenerationResult {
  nfts: GeneratedNFT[];
  requested: number;
  generated: number;
  unique: number;
  duplicates: number;
  maxCombinations: number;
  traitTypes: number;
  distribution: TraitDistributionRow[];
}

export type ValidationSeverity = "error" | "warning";

export interface GenerationValidationError {
  code:
    | "NAME_REQUIRED"
    | "SUPPLY_INVALID"
    | "DIMENSION_INVALID"
    | "NO_LAYERS"
    | "EMPTY_LAYER"
    | "NEGATIVE_WEIGHT"
    | "ZERO_TOTAL_WEIGHT"
    | "MISSING_ASSET"
    | "INSUFFICIENT_COMBINATIONS"
    | "NOT_GENERATED"
    | "MISSING_IMAGE"
    | "ORPHAN_IMAGE"
    | "DUPLICATE_TOKEN_ID"
    | "DUPLICATE_DNA"
    | "BATCH_TOO_LARGE";
  severity: ValidationSeverity;
  message: string;
  subject?: string | undefined;
}

export interface ExportBatch {
  /** Folder + archive base name, e.g. `otters-outbreak-1-100`. */
  name: string;
  from: number;
  to: number;
  tokenIds: number[];
}

export interface ExportFile {
  filename: string;
  bytes: Uint8Array;
  /** NFT count (0 for the collection metadata archive). */
  count: number;
  kind: "collection" | "batch" | "bundle";
}
