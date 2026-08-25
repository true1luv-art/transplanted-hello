/**
 * Trait configuration validation. Generation must fail loudly rather than
 * silently emitting invalid NFTs.
 */
import { selectableValues, totalWeight } from "./weighted-random";
import { TraitValidationError, type TraitLayerConfig } from "./types";

export interface TraitIssue {
  code: TraitValidationError["code"];
  message: string;
  layerName?: string;
}

/** Layers that participate in generation, in deterministic order. */
export function activeLayers(layers: TraitLayerConfig[]): TraitLayerConfig[] {
  return layers
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Theoretical number of distinct complete combinations. */
export function maxCombinations(layers: TraitLayerConfig[]): number {
  const active = activeLayers(layers);
  if (active.length === 0) return 0;
  return active.reduce((product, layer) => product * selectableValues(layer.values).length, 1);
}

/** Collects every configuration problem without throwing. */
export function validateTraitConfig(layers: TraitLayerConfig[], supply?: number): TraitIssue[] {
  const issues: TraitIssue[] = [];
  const active = activeLayers(layers);

  if (active.length === 0) {
    issues.push({ code: "NO_LAYERS", message: "At least one enabled trait layer is required" });
    return issues;
  }

  for (const layer of active) {
    if (layer.values.length === 0) {
      issues.push({
        code: "EMPTY_LAYER",
        message: `Layer "${layer.name}" has no trait values`,
        layerName: layer.name,
      });
      continue;
    }
    const negative = layer.values.find((v) => v.weight < 0);
    if (negative) {
      issues.push({
        code: "NEGATIVE_WEIGHT",
        message: `Layer "${layer.name}" has a negative weight on "${negative.name}"`,
        layerName: layer.name,
      });
    }
    if (selectableValues(layer.values).length === 0 || totalWeight(layer.values) <= 0) {
      issues.push({
        code: "ZERO_TOTAL_WEIGHT",
        message: `Layer "${layer.name}" has no enabled trait value with a positive weight`,
        layerName: layer.name,
      });
    }
  }

  if (supply && supply > 0) {
    const combos = maxCombinations(layers);
    if (combos > 0 && combos < supply) {
      issues.push({
        code: "INSUFFICIENT_COMBINATIONS",
        message: `Trait system produces at most ${combos} unique combinations but supply is ${supply}`,
      });
    }
  }

  return issues;
}

/** Throwing variant used by the generator and the transaction pipeline. */
export function assertTraitConfig(layers: TraitLayerConfig[], supply?: number): void {
  const [issue] = validateTraitConfig(layers, supply);
  if (issue) throw new TraitValidationError(issue.message, issue.code, issue.layerName);
}
