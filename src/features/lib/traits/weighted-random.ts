/**
 * Weighted random selection. The single entry point for picking trait values —
 * never use `Math.random() * values.length` anywhere in the app.
 */
import { TraitValidationError, type TraitValueConfig } from "./types";

export interface WeightedPick {
  value: TraitValueConfig;
  /** Normalised probability of the picked value inside the candidate set. */
  probability: number;
  totalWeight: number;
}

/** Candidates that can actually be selected: enabled and strictly positive. */
export function selectableValues(values: TraitValueConfig[]): TraitValueConfig[] {
  return values.filter((v) => v.enabled && Number.isFinite(v.weight) && v.weight > 0);
}

export function totalWeight(values: TraitValueConfig[]): number {
  return selectableValues(values).reduce((sum, v) => sum + v.weight, 0);
}

/** Normalised probability of each selectable value (0-1), keyed by value id. */
export function normalizedProbabilities(values: TraitValueConfig[]): Map<string, number> {
  const total = totalWeight(values);
  const map = new Map<string, number>();
  if (total <= 0) return map;
  for (const value of selectableValues(values)) map.set(value.id, value.weight / total);
  return map;
}

/**
 * Picks one value using cumulative weights.
 *
 * - disabled values are ignored
 * - zero weights are never selected
 * - negative weights are rejected
 * - a zero total weight is rejected
 */
export function weightedRandom(
  values: TraitValueConfig[],
  rand: () => number = Math.random,
  layerName?: string,
): WeightedPick {
  for (const value of values) {
    if (Number.isFinite(value.weight) && value.weight < 0) {
      throw new TraitValidationError(
        `Negative weight on "${value.name}"${layerName ? ` in layer "${layerName}"` : ""}`,
        "NEGATIVE_WEIGHT",
        layerName,
      );
    }
  }

  const candidates = selectableValues(values);
  const total = candidates.reduce((sum, v) => sum + v.weight, 0);
  if (candidates.length === 0 || total <= 0) {
    throw new TraitValidationError(
      `No selectable trait value${layerName ? ` in layer "${layerName}"` : ""} — total weight is zero`,
      "ZERO_TOTAL_WEIGHT",
      layerName,
    );
  }

  let roll = rand() * total;
  for (const value of candidates) {
    roll -= value.weight;
    if (roll <= 0) return { value, probability: value.weight / total, totalWeight: total };
  }

  const last = candidates[candidates.length - 1]!;
  return { value: last, probability: last.weight / total, totalWeight: total };
}
