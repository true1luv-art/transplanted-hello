/**
 * Deterministic weighted NFT generator.
 *
 * Traits are generated BEFORE minting. Minting later claims an already
 * generated token — it never rolls traits.
 */
import { hashString, mulberry32 } from "@/lib/art";
import { assignRarityRanks } from "./rarity";
import { calculateRarityScore } from "./rarity";
import { activeLayers, assertTraitConfig, maxCombinations } from "./validation";
import { weightedRandom } from "./weighted-random";
import {
  TraitValidationError,
  type GeneratedToken,
  type GeneratedTrait,
  type TraitLayerConfig,
} from "./types";

/** Deterministic signature of a complete combination. */
export function combinationSignature(traits: GeneratedTrait[]): string {
  return [...traits]
    .sort((a, b) => a.layerName.localeCompare(b.layerName))
    .map((t) => `${t.layerName}:${t.traitValueName}`)
    .join("|");
}

/** Rolls one complete combination across every enabled layer. */
export function generateTraits(
  layers: TraitLayerConfig[],
  rand: () => number = Math.random,
): GeneratedTrait[] {
  const traits: GeneratedTrait[] = [];
  for (const layer of activeLayers(layers)) {
    const pick = weightedRandom(layer.values, rand, layer.name);
    traits.push({
      layerId: layer.id,
      layerName: layer.name,
      traitValueId: pick.value.id,
      traitValueName: pick.value.name,
      weight: pick.value.weight,
      probability: Number(pick.probability.toFixed(6)),
    });
  }
  return traits;
}

export interface GenerateInventoryInput {
  layers: TraitLayerConfig[];
  count: number;
  /** Deterministic seed so SSR and client agree. */
  seedKey: string;
  /** Token numbers to assign, defaults to 1..count. */
  tokenNumbers?: number[];
  /** Retries per token before giving up on uniqueness. */
  maxAttempts?: number;
  /** Combinations already used (regeneration / incremental mint). */
  usedSignatures?: Iterable<string>;
}

export interface GeneratedInventory {
  tokens: GeneratedToken[];
  uniqueCombinations: number;
  maxCombinations: number;
}

/**
 * Generates a full inventory of unique combinations, then scores, ranks and
 * classifies it collection-wide.
 */
export function generateInventory(input: GenerateInventoryInput): GeneratedInventory {
  const { layers, count, seedKey } = input;
  assertTraitConfig(layers, count);

  const capacity = maxCombinations(layers);
  if (capacity < count) {
    throw new TraitValidationError(
      `Trait system produces at most ${capacity} unique combinations but ${count} tokens were requested`,
      "INSUFFICIENT_COMBINATIONS",
    );
  }

  const rand = mulberry32(hashString(seedKey));
  const used = new Set<string>(input.usedSignatures ?? []);
  const maxAttempts = input.maxAttempts ?? 60;
  const tokens: GeneratedToken[] = [];

  for (let i = 0; i < count; i++) {
    const tokenNumber = input.tokenNumbers?.[i] ?? i + 1;
    let traits: GeneratedTrait[] | null = null;
    let signature = "";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = generateTraits(layers, rand);
      const candidateSignature = combinationSignature(candidate);
      if (!used.has(candidateSignature)) {
        traits = candidate;
        signature = candidateSignature;
        break;
      }
    }

    // Bounded retry — never loop forever. Fall back to the first unused
    // combination so a near-saturated trait space still completes.
    if (!traits) {
      const fallback = firstUnusedCombination(layers, used);
      if (!fallback) {
        throw new TraitValidationError(
          `Exhausted unique combinations after ${tokens.length} of ${count} tokens`,
          "INSUFFICIENT_COMBINATIONS",
        );
      }
      traits = fallback;
      signature = combinationSignature(fallback);
    }

    used.add(signature);
    tokens.push({
      tokenNumber,
      traits,
      signature,
      rarityScore: calculateRarityScore(traits),
      rarityRank: 0,
    });
  }

  const ranks = assignRarityRanks(
    tokens.map((t) => ({ id: String(t.tokenNumber), rarityScore: t.rarityScore })),
  );
  const byId = new Map(ranks.map((r) => [r.id, r]));
  for (const token of tokens) {
    const rank = byId.get(String(token.tokenNumber));
    if (rank) {
      token.rarityRank = rank.rarityRank;
    }
  }

  return {
    tokens,
    uniqueCombinations: new Set(tokens.map((t) => t.signature)).size,
    maxCombinations: capacity,
  };
}

/** Deterministic cartesian walk used only when random retries are exhausted. */
function firstUnusedCombination(
  layers: TraitLayerConfig[],
  used: Set<string>,
): GeneratedTrait[] | null {
  const active = activeLayers(layers);
  const pools = active.map((layer) => ({
    layer,
    values: layer.values.filter((v) => v.enabled && v.weight > 0),
  }));
  const totals = pools.map((p) => p.values.reduce((s, v) => s + v.weight, 0));
  const sizes = pools.map((p) => p.values.length);
  const capacity = sizes.reduce((a, b) => a * b, 1);

  for (let index = 0; index < capacity; index++) {
    let remainder = index;
    const traits: GeneratedTrait[] = pools.map((pool, i) => {
      const size = sizes[i]!;
      const pick = pool.values[remainder % size]!;
      remainder = Math.floor(remainder / size);
      return {
        layerId: pool.layer.id,
        layerName: pool.layer.name,
        traitValueId: pick.id,
        traitValueName: pick.name,
        weight: pick.weight,
        probability: Number((pick.weight / (totals[i] || 1)).toFixed(6)),
      };
    });
    if (!used.has(combinationSignature(traits))) return traits;
  }
  return null;
}
