/**
 * Actual vs configured trait distribution.
 *
 * Weights are probabilities, not quotas: a 40% weight over 1,000 tokens lands
 * around 400 but is not forced to be exactly 400.
 */
import { normalizedProbabilities } from "./weighted-random";
import { activeLayers } from "./validation";
import type { GeneratedTrait, TraitLayerConfig, TraitValueFrequency } from "./types";

export function calculateTraitFrequencies(
  layers: TraitLayerConfig[],
  tokens: { traits: GeneratedTrait[] }[],
): TraitValueFrequency[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    for (const trait of token.traits) {
      counts.set(trait.traitValueId, (counts.get(trait.traitValueId) ?? 0) + 1);
    }
  }

  const total = tokens.length;
  const rows: TraitValueFrequency[] = [];

  for (const layer of activeLayers(layers)) {
    const probabilities = normalizedProbabilities(layer.values);
    for (const value of layer.values) {
      const count = counts.get(value.id) ?? 0;
      rows.push({
        layerId: layer.id,
        layerName: layer.name,
        traitValueId: value.id,
        traitValueName: value.name,
        weight: value.weight,
        configuredProbability: probabilities.get(value.id) ?? 0,
        count,
        actualFrequency: total > 0 ? count / total : 0,
      });
    }
  }

  return rows;
}

/** Summary shown after generation (rule 26). */
export interface GenerationSummary {
  totalTokens: number;
  layerCount: number;
  valueCount: number;
  uniqueCombinations: number;
  maxCombinations: number;
  averageRarityScore: number;
  highestRarityScore: number;
  rarestTokenNumber: number | null;
  frequencies: TraitValueFrequency[];
}

export function buildGenerationSummary(
  layers: TraitLayerConfig[],
  tokens: {
    tokenNumber: number;
    traits: GeneratedTrait[];
    rarityScore: number;
    signature: string;
  }[],
  maxCombinations: number,
): GenerationSummary {
  const active = activeLayers(layers);
  const scores = tokens.map((t) => t.rarityScore);
  const highest = scores.length ? Math.max(...scores) : 0;
  const rarest = tokens.find((t) => t.rarityScore === highest) ?? null;

  return {
    totalTokens: tokens.length,
    layerCount: active.length,
    valueCount: active.reduce((sum, l) => sum + l.values.length, 0),
    uniqueCombinations: new Set(tokens.map((t) => t.signature)).size,
    maxCombinations,
    averageRarityScore: scores.length
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
      : 0,
    highestRarityScore: Number(highest.toFixed(2)),
    rarestTokenNumber: rarest?.tokenNumber ?? null,
    frequencies: calculateTraitFrequencies(layers, tokens),
  };
}
