/**
 * Seed trait configurations.
 *
 * Values are named after what they LOOK like — never rarity tiers.
 * Their rarity comes purely from the weights.
 */
import type { TraitLayerConfig, TraitValueConfig } from "./types";

interface LayerSpec {
  name: string;
  values: [string, number][];
}

const BASE_LAYERS: LayerSpec[] = [
  {
    name: "Background",
    values: [
      ["Blue", 40],
      ["Red", 30],
      ["Purple", 20],
      ["Gold", 10],
    ],
  },
  {
    name: "Body",
    values: [
      ["Standard", 45],
      ["Chrome", 30],
      ["Obsidian", 17],
      ["Robot", 8],
    ],
  },
  {
    name: "Clothes",
    values: [
      ["None", 35],
      ["Hoodie", 30],
      ["Flight Suit", 20],
      ["Armor", 12],
      ["Ceremonial Robe", 3],
    ],
  },
  {
    name: "Eyes",
    values: [
      ["Normal", 60],
      ["Laser", 25],
      ["Cyber", 10],
      ["Diamond", 5],
    ],
  },
  {
    name: "Mouth",
    values: [
      ["Smile", 50],
      ["Serious", 30],
      ["Fang", 15],
      ["Golden", 5],
    ],
  },
  {
    name: "Hat",
    values: [
      ["None", 60],
      ["Cap", 25],
      ["Crown", 10],
      ["Halo", 5],
    ],
  },
  {
    name: "Accessory",
    values: [
      ["None", 70],
      ["Earring", 18],
      ["Hive Badge", 9],
      ["Aura", 3],
    ],
  },
];

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function buildTraitLayers(
  collectionId: string,
  specs: LayerSpec[] = BASE_LAYERS,
): TraitLayerConfig[] {
  return specs.map((spec, index) => {
    const layerId = `${collectionId}-layer-${slug(spec.name)}`;
    const values: TraitValueConfig[] = spec.values.map(([name, weight]) => ({
      id: `${layerId}-${slug(name)}`,
      name,
      weight,
      enabled: true,
    }));
    return { id: layerId, name: spec.name, order: index + 1, enabled: true, values };
  });
}

/**
 * Per-collection flavour: the Body layer takes the collection's own nouns so
 * every catalogue entry reads like its own generative project.
 */
export function buildCollectionTraitLayers(
  collectionId: string,
  nouns: string[],
): TraitLayerConfig[] {
  const weights = [45, 30, 17, 8, 4, 2];
  const specs = BASE_LAYERS.map((layer) =>
    layer.name === "Body" && nouns.length >= 2
      ? {
          name: "Body",
          values: nouns.slice(0, 6).map((noun, i) => [noun, weights[i] ?? 2] as [string, number]),
        }
      : layer,
  );
  return buildTraitLayers(collectionId, specs);
}

/** Default configuration offered in the creator wizard. */
export const DEFAULT_TRAIT_LAYERS: TraitLayerConfig[] = buildTraitLayers("draft");
