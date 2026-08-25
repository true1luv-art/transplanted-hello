/**
 * Trait + weight system (Phase 2 polish).
 *
 * Rarity is NEVER an input. The pipeline is:
 *   layers -> values -> weights -> weighted random -> combination ->
 *   rarity score -> rarity rank (no rarity tiers exist)
 */

/** A single selectable value inside a trait layer. */
export interface TraitValueConfig {
  id: string;
  name: string;
  /** Relative weight. Weights do NOT have to sum to 100. */
  weight: number;
  enabled: boolean;
  assetId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/** An ordered layer of the generative stack (Background, Eyes, Hat, …). */
export interface TraitLayerConfig {
  id: string;
  name: string;
  /** Deterministic composition order, ascending. */
  order: number;
  enabled: boolean;
  values: TraitValueConfig[];
}

/** One resolved trait on a generated token. */
export interface GeneratedTrait {
  layerId: string;
  layerName: string;
  traitValueId: string;
  traitValueName: string;
  weight: number;
  /** Normalised probability of this value inside its layer (0-1). */
  probability: number;
}

export interface GeneratedToken {
  tokenNumber: number;
  traits: GeneratedTrait[];
  signature: string;
  rarityScore: number;
  /** Filled in by `assignRarityRanks` once the whole collection exists. */
  rarityRank: number;
}

export interface TraitValueFrequency {
  layerId: string;
  layerName: string;
  traitValueId: string;
  traitValueName: string;
  weight: number;
  /** Configured normalised probability (0-1). */
  configuredProbability: number;
  count: number;
  /** Observed share of the generated inventory (0-1). */
  actualFrequency: number;
}

export class TraitValidationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_LAYERS"
      | "EMPTY_LAYER"
      | "NEGATIVE_WEIGHT"
      | "ZERO_TOTAL_WEIGHT"
      | "INSUFFICIENT_COMBINATIONS",
    readonly layerName?: string,
  ) {
    super(message);
    this.name = "TraitValidationError";
  }
}
