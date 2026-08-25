/**
 * Generation engine — pure and deterministic when a PRNG is supplied.
 *
 * Runs in the browser and in Node tests: no canvas, no DOM, no network.
 * Composition of the actual pixels lives in `compose.ts`.
 */
import {
  weightedRandom,
  normalizedProbabilities,
  selectableValues,
} from "@/features/lib/traits/weighted-random";
import type {
  GeneratedNFT,
  GeneratedTraitRef,
  GenerationResult,
  GeneratorLayer,
  GeneratorProject,
  TraitDistributionRow,
} from "./types";
import { FIRST_ITEM_NUMBER } from "./types";
import { imageFilenameFor, imageReferenceFor, itemNameFor, metadataFilenameFor } from "./naming";

/** Layers that participate in generation: enabled with at least one pickable trait. */
export function activeLayers(layers: GeneratorLayer[]): GeneratorLayer[] {
  return layers
    .filter((layer) => layer.enabled && selectableValues(layer.traits).length > 0)
    .sort((a, b) => a.order - b.order);
}

/** Product of the pickable trait counts across active layers. */
export function maxCombinations(layers: GeneratorLayer[]): number {
  const active = activeLayers(layers);
  if (active.length === 0) return 0;
  return active.reduce((product, layer) => product * selectableValues(layer.traits).length, 1);
}

/** Deterministic DNA for a combination: `layerId:traitId|…` in layer order. */
export function dnaOf(traits: GeneratedTraitRef[]): string {
  return traits.map((trait) => `${trait.layerId}:${trait.traitId}`).join("|");
}

/** Human-readable signature used in the UI. */
export function dnaLabel(traits: GeneratedTraitRef[]): string {
  return traits.map((trait) => `${trait.layerName}:${trait.traitName}`).join(" / ");
}

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly code: "INSUFFICIENT_COMBINATIONS" | "NO_LAYERS",
    readonly detail?: { possible: number; requested: number },
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export interface GenerateOptions {
  project: GeneratorProject;
  /** Limit the run (preview mode). Defaults to `settings.supply`. */
  count?: number | undefined;
  rand?: (() => number) | undefined;
  /** Called after each NFT so the UI can show progress. */
  onProgress?: ((done: number, total: number) => void) | undefined;
}

/**
 * Draws unique combinations until `count` NFTs exist. Duplicate DNA is never
 * emitted — a repeated draw is retried, never stored.
 */
export function generateCollection(options: GenerateOptions): GenerationResult {
  const { project, rand = Math.random, onProgress } = options;
  const total = Math.max(0, Math.floor(options.count ?? project.settings.supply));
  const layers = activeLayers(project.layers);

  if (layers.length === 0) {
    throw new GenerationError("Add at least one enabled layer with a weighted trait", "NO_LAYERS");
  }

  const possible = maxCombinations(project.layers);
  if (total > possible) {
    throw new GenerationError(
      `Requested supply exceeds the number of unique trait combinations. Possible unique combinations: ${possible} · Requested supply: ${total}`,
      "INSUFFICIENT_COMBINATIONS",
      { possible, requested: total },
    );
  }

  const probabilities = new Map(
    layers.map((layer) => [layer.id, normalizedProbabilities(layer.traits)]),
  );
  const seen = new Set<string>();
  const nfts: GeneratedNFT[] = [];
  let duplicates = 0;
  const start = FIRST_ITEM_NUMBER;
  const maxAttempts = Math.max(1000, total * 200);
  let attempts = 0;

  while (nfts.length < total && attempts < maxAttempts) {
    attempts += 1;
    const traits: GeneratedTraitRef[] = layers.map((layer) => {
      const pick = weightedRandom(layer.traits, rand, layer.name);
      return {
        layerId: layer.id,
        layerName: layer.name,
        traitId: pick.value.id,
        traitName: pick.value.name,
        weight: pick.value.weight,
        probability: probabilities.get(layer.id)?.get(pick.value.id) ?? pick.probability,
      };
    });

    const dna = dnaOf(traits);
    if (seen.has(dna)) {
      duplicates += 1;
      continue;
    }
    seen.add(dna);

    const tokenId = start + nfts.length;
    nfts.push({
      tokenId,
      name: itemNameFor(project.settings, tokenId),
      description: project.settings.description,
      dna,
      traits,
      imageFilename: imageFilenameFor(project.settings, tokenId),
      metadataFilename: metadataFilenameFor(project.settings, tokenId),
      imageReference: imageReferenceFor(project.settings, tokenId),
    });
    onProgress?.(nfts.length, total);
  }

  if (nfts.length < total) {
    throw new GenerationError(
      `Requested supply exceeds the number of unique trait combinations. Possible unique combinations: ${possible} · Requested supply: ${total}`,
      "INSUFFICIENT_COMBINATIONS",
      { possible, requested: total },
    );
  }

  const distribution = traitDistribution(project.layers, nfts);

  return {
    nfts,
    requested: total,
    generated: nfts.length,
    unique: seen.size,
    duplicates,
    maxCombinations: possible,
    traitTypes: layers.length,
    distribution,
  };
}

/** Configured (expected) vs observed (actual) trait shares. */
export function traitDistribution(
  layers: GeneratorLayer[],
  nfts: GeneratedNFT[],
): TraitDistributionRow[] {
  const counts = new Map<string, number>();
  for (const nft of nfts) {
    for (const trait of nft.traits) counts.set(trait.traitId, (counts.get(trait.traitId) ?? 0) + 1);
  }

  const rows: TraitDistributionRow[] = [];
  for (const layer of activeLayers(layers)) {
    const expected = normalizedProbabilities(layer.traits);
    for (const trait of layer.traits) {
      const count = counts.get(trait.id) ?? 0;
      rows.push({
        layerId: layer.id,
        layerName: layer.name,
        traitId: trait.id,
        traitName: trait.name,
        weight: trait.weight,
        expected: expected.get(trait.id) ?? 0,
        actual: nfts.length > 0 ? count / nfts.length : 0,
        count,
      });
    }
  }
  return rows;
}
