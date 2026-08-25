/**
 * Trait engine test suite (Phase 2 polish).
 *
 * Run with: `npm run test:traits`
 *
 * Verifies:
 *  - weightedRandom respects weights, skips disabled/zero, rejects invalid config
 *  - rarity score = Σ 1 / probability
 *  - rank ordering is score-descending and deterministic on ties
 *  - trait frequency reporting matches the generated inventory
 *  - API schema rejects invalid trait-layer configuration
 */
import {
  assignRarityRanks,
  calculateRarityScore,
  calculateTraitFrequencies,
  generateInventory,
  maxCombinations,
  normalizedProbabilities,
  validateTraitConfig,
  weightedRandom,
  type TraitLayerConfig,
} from "@/features/lib/traits";
import { createCollectionSchema } from "@/server/api/schemas";

interface Result {
  name: string;
  ok: boolean;
  error?: string;
}
const results: Result[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const value = (id: string, weight: number, enabled = true) => ({ id, name: id, weight, enabled });

const layer = (
  id: string,
  order: number,
  values: ReturnType<typeof value>[],
): TraitLayerConfig => ({
  id,
  name: id,
  order,
  enabled: true,
  values,
});

/** Deterministic PRNG so generation assertions are reproducible. */
function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("weightedRandom picks by cumulative weight", () => {
  const values = [value("a", 70), value("b", 30)];
  assert(weightedRandom(values, () => 0.1).value.id === "a", "low roll should pick 'a'");
  assert(weightedRandom(values, () => 0.9).value.id === "b", "high roll should pick 'b'");
  assert(
    Math.abs(weightedRandom(values, () => 0.1).probability - 0.7) < 1e-9,
    "probability must be normalised",
  );
});

test("weightedRandom never returns disabled or zero-weight values", () => {
  const values = [value("off", 90, false), value("zero", 0), value("on", 10)];
  for (let i = 0; i < 200; i++) {
    const pick = weightedRandom(values, seeded(i + 1)).value.id;
    assert(pick === "on", `unexpected pick ${pick}`);
  }
});

test("weightedRandom rejects negative and zero-total weights", () => {
  let threw = false;
  try {
    weightedRandom([value("a", -1), value("b", 5)]);
  } catch {
    threw = true;
  }
  assert(threw, "negative weight must throw");

  threw = false;
  try {
    weightedRandom([value("a", 0)]);
  } catch {
    threw = true;
  }
  assert(threw, "zero total weight must throw");
});

test("weight distribution converges over many rolls", () => {
  const values = [value("a", 80), value("b", 20)];
  const rand = seeded(42);
  let a = 0;
  const runs = 20_000;
  for (let i = 0; i < runs; i++) if (weightedRandom(values, rand).value.id === "a") a++;
  const share = a / runs;
  assert(Math.abs(share - 0.8) < 0.02, `expected ~80% 'a', got ${(share * 100).toFixed(1)}%`);
});

test("normalizedProbabilities sums to 1 over selectable values", () => {
  const probs = [
    ...normalizedProbabilities([value("a", 30), value("b", 10), value("c", 0)]).values(),
  ];
  assert(Math.abs(probs.reduce((s, p) => s + p, 0) - 1) < 1e-9, "probabilities must sum to 1");
  assert(probs.length === 2, "zero-weight values must be excluded");
});

test("rarity score is the sum of 1 / probability", () => {
  const traits = [
    {
      layerId: "l1",
      layerName: "l1",
      traitValueId: "a",
      traitValueName: "a",
      weight: 25,
      probability: 0.25,
    },
    {
      layerId: "l2",
      layerName: "l2",
      traitValueId: "b",
      traitValueName: "b",
      weight: 10,
      probability: 0.1,
    },
  ];
  assert(calculateRarityScore(traits) === 14, `expected 14, got ${calculateRarityScore(traits)}`);
  assert(calculateRarityScore([]) === 0, "empty traits must score 0");
});

test("ranks are score-descending and deterministic on ties", () => {
  const ranked = assignRarityRanks([
    { id: "low", rarityScore: 5 },
    { id: "high", rarityScore: 50 },
    { id: "b-tie", rarityScore: 20 },
    { id: "a-tie", rarityScore: 20 },
  ]);
  assert(ranked[0]!.id === "high" && ranked[0]!.rarityRank === 1, "highest score must rank 1");
  assert(ranked[1]!.id === "a-tie" && ranked[2]!.id === "b-tie", "ties must break by id");
  assert(ranked[3]!.id === "low", "lowest score must rank last");
});

test("generated inventory is unique and matches the configured distribution", () => {
  const layers = [
    layer("Background", 0, [value("Sky", 70), value("Void", 30)]),
    layer("Eyes", 1, [value("Calm", 60), value("Laser", 40)]),
    layer("Hat", 2, [value("None", 80), value("Crown", 20)]),
  ];
  assert(maxCombinations(layers) === 8, "8 combinations expected");

  const inventory = generateInventory({ layers, count: 8, seedKey: "test-collection" });
  assert(inventory.tokens.length === 8, "must generate the full supply");
  assert(
    new Set(inventory.tokens.map((t) => t.signature)).size === 8,
    "combinations must be unique",
  );

  const frequencies = calculateTraitFrequencies(layers, inventory.tokens);
  const counted = frequencies
    .filter((f) => f.layerName === "Background")
    .reduce((sum, f) => sum + f.count, 0);
  assert(counted === 8, `background counts must cover every token, got ${counted}`);
  for (const row of frequencies) {
    assert(row.actualFrequency >= 0 && row.actualFrequency <= 1, "frequency must be a 0-1 share");
  }
});

test("validation catches empty, zero-weight and under-supplied configs", () => {
  assert(
    validateTraitConfig([]).some((i) => i.code === "NO_LAYERS"),
    "no layers must fail",
  );
  assert(
    validateTraitConfig([layer("L", 0, [value("a", 0)])]).some(
      (i) => i.code === "ZERO_TOTAL_WEIGHT",
    ),
    "zero weight layer must fail",
  );
  assert(
    validateTraitConfig([layer("L", 0, [value("a", -5), value("b", 1)])]).some(
      (i) => i.code === "NEGATIVE_WEIGHT",
    ),
    "negative weight must fail",
  );
  assert(
    validateTraitConfig([layer("L", 0, [value("a", 1), value("b", 1)])], 10).some(
      (i) => i.code === "INSUFFICIENT_COMBINATIONS",
    ),
    "supply above max combinations must fail",
  );
});

test("createCollectionSchema rejects an invalid trait configuration", () => {
  const assetUri = "ipfs://bafybeiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const base = {
    requestId: "req_traits_test_1",
    name: "Trait Test",
    symbol: "TT",
    description: "A collection used by the trait test suite.",
    maxSupply: 4,
    mintPrice: 1,
    creatorFee: 5,
    platformFee: 2,
    assets: {
      collectionImageUri: assetUri,
      collectionMetadataUri: assetUri,
      assetRootUri: assetUri,
      metadataRootUri: assetUri,
      reusableAssets: true,
      items: [
        {
          tokenNumber: 1,
          filename: "1.png",
          mimeType: "image/png",
          size: 10,
          imageUri: `${assetUri}/1.png`,
          metadataUri: `${assetUri}/1.json`,
          cid: "bafybeiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    },
  };

  const good = createCollectionSchema.safeParse({
    ...base,
    traitLayers: [
      layer("Background", 0, [value("Sky", 70), value("Void", 30)]),
      layer("Eyes", 1, [value("Calm", 60), value("Laser", 40)]),
    ],
  });
  assert(
    good.success,
    `valid config was rejected: ${good.success ? "" : good.error.issues[0]?.message}`,
  );

  // Imported collections carry no generative configuration at all.
  const imported = createCollectionSchema.safeParse({ ...base });
  assert(imported.success, "imported collections without trait layers must be accepted");

  const negative = createCollectionSchema.safeParse({
    ...base,
    traitLayers: [layer("Background", 0, [value("Sky", -1), value("Void", 30)])],
  });
  assert(!negative.success, "negative weights must be rejected");

  const tooFew = createCollectionSchema.safeParse({
    ...base,
    maxSupply: 100,
    traitLayers: [layer("Background", 0, [value("Sky", 1), value("Void", 1)])],
  });
  assert(!tooFew.success, "supply above max combinations must be rejected");
});

for (const r of results)
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.error ? ` — ${r.error}` : ""}`);
const failures = results.filter((r) => !r.ok);
console.log(`\n${results.length - failures.length}/${results.length} passed`);
if (failures.length) process.exit(1);
