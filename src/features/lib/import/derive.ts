/**
 * Derived views over an imported collection.
 *
 * These structures are OUTPUTS of the import, never inputs: the "weights" are
 * observed counts, not creator-configured probabilities. They exist so the
 * existing collection UI (trait distribution chart, trait panels) can render
 * imported collections without a generative configuration.
 */
import type { TraitLayerConfig } from "@/features/lib/traits/types";
import type { ImportReport } from "./types";

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Trait types/values with observed counts as weights — display only. */
export function traitLayersFromImport(report: ImportReport): TraitLayerConfig[] {
  return report.traits.map((trait, order) => ({
    id: `t-${slug(trait.traitType)}`,
    name: trait.traitType,
    order,
    enabled: true,
    values: trait.values.map((value) => ({
      id: `t-${slug(trait.traitType)}:${slug(String(value.value))}`,
      name: String(value.value),
      weight: value.count,
      enabled: true,
    })),
  }));
}

/** `attributes` in the shape the app's NFT records use. */
export function toNftAttributes(attributes: { trait_type: string; value: string | number }[]) {
  return attributes.map((attribute) => ({ trait_type: attribute.trait_type, value: attribute.value }));
}
