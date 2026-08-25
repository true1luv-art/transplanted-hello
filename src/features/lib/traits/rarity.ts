/**
 * Rarity derivation. One source of truth for the formula — never inline
 * `1 / probability` anywhere else.
 */
import { activeLayers } from "./validation";
import { normalizedProbabilities } from "./weighted-random";
import type { GeneratedTrait, TraitLayerConfig } from "./types";

/** Rarity score = sum of 1 / probability for every selected trait. */
export function calculateRarityScore(traits: GeneratedTrait[]): number {
  const score = traits.reduce((sum, trait) => {
    if (!trait.probability || trait.probability <= 0) return sum;
    return sum + 1 / trait.probability;
  }, 0);
  return Number(score.toFixed(4));
}

/** Contribution of a single trait, exposed for UI breakdowns. */
export function traitRarityContribution(trait: GeneratedTrait): number {
  if (!trait.probability || trait.probability <= 0) return 0;
  return Number((1 / trait.probability).toFixed(4));
}

/**
 * Theoretical maximum rarity score for a collection: the sum of the rarest
 * selectable value in every active layer. Used as the "out of" denominator
 * so users see how an NFT's score compares to the collection ceiling.
 */
export function calculateMaxRarityScore(layers: TraitLayerConfig[]): number {
  const active = activeLayers(layers);
  if (active.length === 0) return 0;
  let score = 0;
  for (const layer of active) {
    const probabilities = normalizedProbabilities(layer.values);
    let minProbability = Infinity;
    for (const p of probabilities.values()) {
      if (p > 0 && p < minProbability) minProbability = p;
    }
    if (minProbability !== Infinity) score += 1 / minProbability;
  }
  return Number(score.toFixed(4));
}

export interface RankableToken {
  id: string;
  rarityScore: number;
}

export interface RankResult {
  id: string;
  rarityRank: number;
}

/**
 * Ranks the WHOLE collection: highest score is rank 1. Ties are broken by id so
 * ranking is deterministic and stable across processes.
 */
export function assignRarityRanks(tokens: RankableToken[]): RankResult[] {
  const sorted = [...tokens].sort(
    (a, b) => b.rarityScore - a.rarityScore || a.id.localeCompare(b.id),
  );
  return sorted.map((token, index) => ({
    id: token.id,
    rarityRank: index + 1,
  }));
}

/** Convenience map form: id -> rank. */
export function rankMap(tokens: RankableToken[]): Map<string, RankResult> {
  return new Map(assignRarityRanks(tokens).map((r) => [r.id, r]));
}
