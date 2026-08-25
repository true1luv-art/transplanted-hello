/**
 * NFT collection IMPORT model (Phase 2 polish).
 *
 * The platform never generates NFTs. The creator brings a finished collection
 * (metadata + images, e.g. exported from NFTexport.io) and we validate, match,
 * index, score and store it.
 *
 * Pipeline:
 *   metadata JSON -> parsed records -> token ids -> image matching ->
 *   validation -> trait frequency -> rarity score -> rarity rank ->
 *   rarity class (display only)
 */

export interface RawAttribute {
  trait_type: string;
  value: string | number;
  /** Any extra keys the creator shipped (display_type, max_value, …). */
  [key: string]: unknown;
}

/** One metadata record exactly as imported — never rewritten. */
export interface ParsedMetadataRecord {
  /** File the record came from. */
  sourceFile: string;
  /** Position inside the source file (0-based). */
  sourceIndex: number;
  name: string;
  description: string;
  image: string;
  externalUrl?: string | undefined;
  attributes: RawAttribute[];
  properties?: Record<string, unknown> | undefined;
  files?: unknown[] | undefined;
  /** Untouched original document. Source of truth. */
  raw: Record<string, unknown>;
}

export interface ImportedNft extends ParsedMetadataRecord {
  tokenId: number;
  /** How the token id was determined. */
  tokenIdSource: "properties" | "edition" | "name" | "image" | "order";
  /** Normalised basename of `image` used for matching. */
  imageKey: string;
  /** Uploaded file matched to `imageKey`, if any. */
  matchedFilename?: string | undefined;
  /** Local object URL for preview — never persisted. */
  previewUrl?: string | undefined;
  /** Σ 1 / traitFrequency across every trait. Derived, deterministic. */
  rarityScore: number;
  /** 1 = rarest. */
  rarityRank: number;
}

export interface TraitValueStat {
  traitType: string;
  value: string;
  count: number;
  /** count / totalNfts (0-1) */
  frequency: number;
}

export interface TraitTypeStat {
  traitType: string;
  values: TraitValueStat[];
  uniqueValues: number;
}

export type IssueSeverity = "error" | "warning";

export type ImportIssueCode =
  | "JSON_SYNTAX"
  | "METADATA_STRUCTURE"
  | "MISSING_NAME"
  | "MISSING_IMAGE_REF"
  | "INVALID_ATTRIBUTES"
  | "DUPLICATE_TOKEN_ID"
  | "DUPLICATE_METADATA"
  | "DUPLICATE_IMAGE_REF"
  | "MISSING_IMAGE"
  | "ORPHAN_IMAGE"
  | "UNSUPPORTED_IMAGE"
  | "SUPPLY_MISMATCH"
  | "COUNT_MISMATCH"
  | "TOKEN_ID_UNRESOLVED"
  | "NO_METADATA"
  | "NO_IMAGES"
  | "ZIP_READ"
  | "ZIP_STRUCTURE"
  | "MISSING_METADATA"
  | "DUPLICATE_IMAGE_FILE"
  | "DUPLICATE_IMAGE_HASH"
  | "COLLECTION_METADATA";

export interface ImportIssue {
  code: ImportIssueCode;
  severity: IssueSeverity;
  message: string;
  /** Metadata name / filename the issue relates to. */
  subject?: string | undefined;
  /** Number of further occurrences collapsed into this issue. */
  count?: number | undefined;
}

export interface ImportStatistics {
  totalNfts: number;
  totalImages: number;
  matchedImages: number;
  missingImages: number;
  orphanImages: number;
  traitTypes: number;
  uniqueTraitValues: number;
  uniqueCombinations: number;
}

export interface ImportReport {
  nfts: ImportedNft[];
  traits: TraitTypeStat[];
  statistics: ImportStatistics;
  issues: ImportIssue[];
  /** No error-severity issues and the supply matches. */
  ready: boolean;
}
