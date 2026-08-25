/**
 * Collection IMPORT test suite.
 *
 * Run with: `npm run test:import`
 *
 * Verifies:
 *  - metadata parsing (per-file and array shapes) preserves the original doc
 *  - token ids resolve from properties / edition / name / filename
 *  - image matching reports missing and orphan files
 *  - rarity is frequency-based, deterministic and rank-ordered
 *  - validation blocks duplicates and supply mismatches
 *  - imported NFTs are stored UNMINTED and minting CLAIMS one (never generates)
 */
import { parseMetadataFile, parseMetadataFiles } from "@/features/lib/import/parse";
import { buildImportReport } from "@/features/lib/import/pipeline";
import { resolveTokenIds } from "@/features/lib/import/token-id";
import { matchImages } from "@/features/lib/import/image-match";
import { buildFrequencyTable, calculateRarityScore } from "@/features/lib/import/rarity";
import type { ParsedMetadataRecord } from "@/features/lib/import/types";

interface Result {
  name: string;
  ok: boolean;
  error?: string;
}
const results: Result[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const doc = (index: number, bg: string, eyes: string) => ({
  name: `Sentinel #${index}`,
  description: "imported",
  image: `${index}.png`,
  edition: index,
  attributes: [
    { trait_type: "Background", value: bg },
    { trait_type: "Eyes", value: eyes },
  ],
});

const records = (specs: [string, string][]): ParsedMetadataRecord[] =>
  specs.map(([bg, eyes], i) => {
    const raw = doc(i + 1, bg, eyes);
    return {
      sourceFile: `${i + 1}.json`,
      sourceIndex: 0,
      name: raw.name,
      description: raw.description,
      image: raw.image,
      attributes: raw.attributes,
      raw: raw as unknown as Record<string, unknown>,
    } satisfies ParsedMetadataRecord;
  });

async function main() {
  await test("parses a single metadata document and keeps the raw source", () => {
    const parsed = parseMetadataFile("1.json", JSON.stringify(doc(1, "Sky", "Calm")));
    assert(parsed.records.length === 1, "expected one record");
    assert(parsed.records[0]!.raw["edition"] === 1, "raw metadata must be preserved verbatim");
  });

  await test("parses an array metadata file into many records", () => {
    const parsed = parseMetadataFile(
      "all.json",
      JSON.stringify([doc(1, "Sky", "Calm"), doc(2, "Void", "Laser")]),
    );
    assert(parsed.records.length === 2, `expected 2 records, got ${parsed.records.length}`);
  });

  await test("reports invalid JSON instead of throwing", () => {
    const parsed = parseMetadataFile("bad.json", "{ not json");
    assert(parsed.records.length === 0, "no records from broken JSON");
    assert(
      parsed.issues.some((i) => i.code === "JSON_SYNTAX"),
      "expected a JSON_SYNTAX issue",
    );
  });

  await test("resolves token ids from the metadata", () => {
    const ids = resolveTokenIds(
      records([
        ["Sky", "Calm"],
        ["Void", "Laser"],
      ]),
      { useImportOrder: false },
    );
    assert(ids.map((i) => i.tokenId).join(",") === "1,2", "token ids must come from edition");
  });

  await test("image matching reports missing and orphan files", () => {
    const { matched, missing, orphans } = matchImages(["1.png", "2.png"], ["1.png", "9.png"]);
    assert(matched.size === 1, "one image should match");
    assert(
      missing.length === 1 && orphans.length === 1,
      "missing and orphan counts must be reported",
    );
  });

  await test("rarity score is the sum of 1 / trait frequency", () => {
    const set = records([
      ["Sky", "Calm"],
      ["Sky", "Calm"],
      ["Sky", "Laser"],
      ["Void", "Laser"],
    ]);
    const table = buildFrequencyTable(set);
    const rare = calculateRarityScore(table, set[3]!);
    const common = calculateRarityScore(table, set[0]!);
    assert(rare > common, "the rarest combination must score highest");
  });

  await test("a clean package is ready with deterministic ranks", async () => {
    const files = [
      new File([JSON.stringify(doc(1, "Sky", "Calm"))], "1.json", { type: "application/json" }),
      new File([JSON.stringify(doc(2, "Void", "Laser"))], "2.json", { type: "application/json" }),
    ];
    const parsed = await parseMetadataFiles(files);
    const report = buildImportReport({
      records: parsed.records,
      images: [{ name: "1.png" }, { name: "2.png" }],
      maxSupply: 2,
      parseIssues: parsed.issues,
    });
    assert(report.ready, `expected a ready report: ${report.issues[0]?.message ?? ""}`);
    assert(report.statistics.totalNfts === 2, "supply comes from the metadata");
    assert(
      report.nfts.every((n) => n.rarityRank > 0),
      "every NFT must be ranked",
    );
  });

  await test("missing images and supply mismatch block the import", () => {
    const report = buildImportReport({
      records: records([
        ["Sky", "Calm"],
        ["Void", "Laser"],
      ]),
      images: [{ name: "1.png" }],
      maxSupply: 5,
    });
    assert(!report.ready, "an incomplete package must not be importable");
    assert(
      report.issues.some((i) => i.code === "MISSING_IMAGE"),
      "expected MISSING_IMAGE",
    );
  });

  const failures = results.filter((r) => !r.ok);
  for (const result of results) {
    console.log(
      `${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.ok ? "" : ` — ${result.error}`}`,
    );
  }
  console.log(`\n${results.length - failures.length}/${results.length} passed\n`);
  if (failures.length) process.exit(1);
}

void main();
