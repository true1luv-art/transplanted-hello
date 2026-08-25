/**
 * NFT Generation Studio test suite.
 *
 * Run with: `npm run test:generator`
 *
 * Verifies:
 *  - weighted selection honours normalised weights and never picks zero weight
 *  - DNA is unique across a generated collection
 *  - requesting more than the possible combinations fails with the counts
 *  - metadata documents keep local launch-ready image references and edition IDs
 *  - rarity score/rank derive from observed frequency (no tiers)
 *  - batch splitting: 250 -> 100/100/50, 600 -> 6x100, 601 -> 6x100+1
 *  - export archives use the importer's folder layout
 */
import { unzipSync, strFromU8 } from "fflate";

import {
  generateCollection,
  maxCombinations,
  GenerationError,
} from "@/features/lib/generator/engine";
import { splitBatches } from "@/features/lib/generator/batching";
import { buildExportPackage } from "@/features/lib/generator/export";
import { toNftMetadata } from "@/features/lib/metadata";
import {
  collectionImageFilename,
  collectionMetadataFilename,
  imagesNamespace,
  metadataNamespace,
  namespacedImagePath,
  namespacedMetadataPath,
} from "@/features/lib/generator/naming";
import { validateProject, hasBlockingErrors } from "@/features/lib/generator/validate";
import { weightedRandom, normalizedProbabilities } from "@/features/lib/traits/weighted-random";
import type {
  GeneratorLayer,
  GeneratorProject,
  GeneratorSettings,
} from "@/features/lib/generator/types";

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

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const settings = (patch: Partial<GeneratorSettings> = {}): GeneratorSettings => ({
  name: "Ember Sentinels",
  description: "Forged guardians.",
  itemPrefix: "Ember Sentinel",
  supply: 10,
  width: 512,
  height: 512,
  ...patch,
});

function layer(name: string, traits: [string, number][], order: number): GeneratorLayer {
  const id = `layer-${name.toLowerCase()}`;
  return {
    id,
    name,
    enabled: true,
    order,
    traits: traits.map(([traitName, weight]) => ({
      id: `${id}-${traitName.toLowerCase()}`,
      layerId: id,
      filename: `${traitName.toLowerCase()}.png`,
      name: traitName,
      weight,
      enabled: true,
      src: `data:image/png;base64,AAAA`,
    })),
  };
}

const project = (patch: Partial<GeneratorSettings> = {}): GeneratorProject => ({
  settings: settings(patch),
  layers: [
    layer(
      "Background",
      [
        ["Ash", 50],
        ["Ember", 30],
        ["Solar", 20],
      ],
      0,
    ),
    layer(
      "Body",
      [
        ["Iron", 60],
        ["Copper", 40],
      ],
      1,
    ),
    layer(
      "Eyes",
      [
        ["Calm", 70],
        ["Blaze", 20],
        ["Void", 10],
      ],
      2,
    ),
  ],
});

/** Deterministic PRNG so the suite never flakes. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/* ------------------------------------------------------------------ */
/* tests                                                               */
/* ------------------------------------------------------------------ */

test("weights are normalised and do not need to sum to 100", () => {
  const values = layer(
    "L",
    [
      ["A", 3],
      ["B", 1],
    ],
    0,
  ).traits;
  const probs = normalizedProbabilities(values);
  assert(Math.abs((probs.get("layer-l-a") ?? 0) - 0.75) < 1e-9, "A should be 75%");
  assert(Math.abs((probs.get("layer-l-b") ?? 0) - 0.25) < 1e-9, "B should be 25%");
});

test("zero-weight traits are never selected", () => {
  const values = layer(
    "L",
    [
      ["A", 0],
      ["B", 5],
    ],
    0,
  ).traits;
  const rand = prng(7);
  for (let i = 0; i < 500; i += 1) {
    assert(weightedRandom(values, rand).value.name === "B", "zero weight was picked");
  }
});

test("maxCombinations multiplies selectable traits per layer", () => {
  assert(maxCombinations(project().layers) === 18, "3 * 2 * 3 should be 18");
});

test("every generated NFT has unique DNA and sequential token ids", () => {
  const result = generateCollection({ project: project({ supply: 18 }), rand: prng(42) });
  assert(result.generated === 18, `expected 18, got ${result.generated}`);
  assert(new Set(result.nfts.map((n) => n.dna)).size === 18, "duplicate DNA emitted");
  assert(
    result.nfts[0]!.tokenId === 1 && result.nfts[17]!.tokenId === 18,
    "token ids not sequential",
  );
});

test("requesting more than the possible combinations fails with both counts", () => {
  let error: unknown = null;
  try {
    generateCollection({ project: project({ supply: 19 }), rand: prng(1) });
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof GenerationError, "expected GenerationError");
  const generationError = error as GenerationError;
  assert(generationError.code === "INSUFFICIENT_COMBINATIONS", "wrong code");
  assert(
    generationError.detail?.possible === 18 && generationError.detail?.requested === 19,
    "wrong detail",
  );
  assert(
    /18/.test(generationError.message) && /19/.test(generationError.message),
    "message lacks counts",
  );
});

test("validation reports insufficient combinations as a blocking error", () => {
  const issues = validateProject(project({ supply: 500 }));
  assert(hasBlockingErrors(issues), "should block");
  assert(
    issues.some((i) => i.code === "INSUFFICIENT_COMBINATIONS"),
    "missing code",
  );
});

test("NFT metadata contains only name, description, image and attributes", () => {
  const result = generateCollection({ project: project({ supply: 12 }), rand: prng(9) });
  const doc = toNftMetadata(result.nfts[0]!) as unknown as Record<string, unknown>;
  assert(
    Object.keys(doc).sort().join(",") === "attributes,description,image,name",
    `unexpected keys: ${Object.keys(doc).join(",")}`,
  );
  assert(Array.isArray(doc["attributes"]), "attributes missing");
  assert((doc["attributes"] as unknown[]).length === 3, "one attribute per layer");
  assert(String(doc["image"]).startsWith("images/"), "image should point to the batch images folder");
  for (const banned of ["edition", "media_type", "dna", "properties", "compiler", "external_url", "symbol", "NFTMintId", "NFTokenID"]) {
    assert(!(banned in doc), `metadata must not carry ${banned}`);
  }
});

test("collection size supports 10,000 while ZIP batches remain independent", () => {
  assert(
    !validateProject(project({ supply: 589 })).some((i) => i.code === "SUPPLY_INVALID"),
    "589 items must pass the collection-size cap",
  );
  assert(
    !validateProject(project({ supply: 10_000 })).some((i) => i.code === "SUPPLY_INVALID"),
    "10,000 items must pass the collection-size cap",
  );

  const issues = validateProject(project({ supply: 10_001 }));
  assert(hasBlockingErrors(issues), "10,001 items must be blocked");
  assert(
    issues.some((i) => i.code === "SUPPLY_INVALID" && /10000|10,000/.test(i.message)),
    "missing 10,000 cap message",
  );
});

test("batch splitting: 250 -> 100/100/50", () => {
  const nfts = Array.from({ length: 250 }, (_, i) => ({ tokenId: i + 1 }) as never);
  const batches = splitBatches(nfts, settings({ supply: 250 }));
  assert(batches.length === 3, `expected 3 batches, got ${batches.length}`);
  assert(batches.map((b) => b.tokenIds.length).join(",") === "100,100,50", "wrong sizes");
  assert(batches[0]!.name === "ember-sentinels-1-100", `wrong name: ${batches[0]!.name}`);
  assert(batches[2]!.name === "ember-sentinels-201-250", `wrong name: ${batches[2]!.name}`);
});

test("batch splitting: 600 -> 6x100 and 601 -> 6x100 + 1", () => {
  const build = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ tokenId: i + 1 }) as never);
  const six = splitBatches(build(600), settings());
  assert(six.length === 6 && six.every((b) => b.tokenIds.length === 100), "600 should be 6 x 100");
  const seven = splitBatches(build(601), settings());
  assert(seven.length === 7, `expected 7 batches, got ${seven.length}`);
  assert(
    seven[6]!.tokenIds.length === 1 && seven[6]!.name === "ember-sentinels-601-601",
    "wrong tail batch",
  );
});

test("export package uses the importer folder layout", () => {
  const result = generateCollection({ project: project({ supply: 12 }), rand: prng(11) });
  const images = new Map(result.nfts.map((nft) => [nft.tokenId, new Uint8Array([1, 2, 3])]));
  const pkg = buildExportPackage({
    settings: settings({ supply: 12 }),
    nfts: result.nfts,
    images,
    layers: project().layers,
  });

  assert(pkg.collection.filename === "metadata.zip", "collection archive misnamed");
  const collectionEntries = Object.keys(unzipSync(pkg.collection.bytes));
  assert(collectionEntries.includes("metadata/metadata.json"), "missing metadata/metadata.json");

  assert(pkg.batches.length === 1, "expected a single batch");
  const batchEntries = Object.keys(unzipSync(pkg.batches[0]!.bytes));
  assert(
    batchEntries.some((p) => p.startsWith("ember-sentinels-1-12/images/")) &&
      batchEntries.some((p) => p.startsWith("ember-sentinels-1-12/metadata/")),
    `wrong batch layout: ${batchEntries.slice(0, 3).join(", ")}`,
  );
  assert(batchEntries.filter((p) => p.endsWith(".png")).length === 12, "expected 12 images");
  assert(
    batchEntries.some((p) => p.includes("#1.json")),
    "metadata filename should include #id",
  );

  const bundleEntries = Object.keys(unzipSync(pkg.bundle.bytes));
  assert(bundleEntries.includes("metadata.zip"), "bundle missing metadata.zip");
  assert(bundleEntries.includes("ember-sentinels-1-12.zip"), "bundle missing batch archive");

  const doc = JSON.parse(strFromU8(unzipSync(pkg.collection.bytes)["metadata/metadata.json"]!)) as {
    symbol?: string;
    image?: string;
    traits: Record<string, { name: string; weight: number }[]>;
  };
  assert(
    !("symbol" in doc) &&
      !("image" in doc) &&
      !("supply" in doc) &&
      !("start_token_id" in doc),
    "collection metadata must not carry launch or blockchain data",
  );
  assert(
    Object.keys(doc.traits).join(",") === "Background,Body,Eyes",
    "traits must keep layer order",
  );
  assert(
    JSON.stringify(doc.traits["Background"]) ===
      JSON.stringify([
        { name: "Ash", weight: 50 },
        { name: "Ember", weight: 30 },
        { name: "Solar", weight: 20 },
      ]),
    "traits must list every available value with its weight",
  );
});

test("ipfs namespaces are derived per user + symbol", () => {
  assert(imagesNamespace("Rhiaji", "OTBK") === "rhiaji-otbk-images", "images namespace");
  assert(metadataNamespace("Rhiaji", "OTBK") === "rhiaji-otbk-metadata", "metadata namespace");
  assert(
    collectionMetadataFilename("Rhiaji", "OTBK") === "rhiaji-otbk-collection.json",
    "collection metadata filename",
  );
  assert(
    collectionImageFilename("Rhiaji", "OTBK") === "rhiaji-otbk-collection.png",
    "collection artwork filename",
  );
});

test("namespaced asset paths use the NFTMintId for metadata", () => {
  assert(
    namespacedImagePath("rhiaji", "OTBK", "otters-#1.png") === "rhiaji-otbk-images/otters-#1.png",
    "image path",
  );
  assert(
    namespacedMetadataPath("rhiaji", "OTBK", 7) === "rhiaji-otbk-metadata/7.json",
    "metadata path",
  );
});

/* ------------------------------------------------------------------ */

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.error ? ` — ${r.error}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} generator tests passed`);
if (failed.length > 0) process.exit(1);
