/**
 * ZIP-based collection IMPORT test suite.
 *
 * Run with: `npm run test:zip-import`
 *
 * Verifies:
 *  - the collection metadata archive is located and parsed (metadata/metadata.json)
 *  - a batch archive requires {batch}/images + {batch}/metadata
 *  - multiple batches combine into one collection with one rarity ranking
 *  - token ids duplicated across batches are rejected
 *  - identical artwork under different filenames is detected by file hash
 *  - a malformed archive fails with an error instead of throwing
 */
import { zipSync, strToU8 } from "fflate";

import {
  readCollectionMetadataZip,
  inspectNftBatch,
  importZipPackage,
} from "@/features/lib/import/zip-batch";
import { mockFileHash } from "@/features/lib/import/zip";
import type { ZipSource } from "@/features/lib/import/zip";

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

/* ------------------------------------------------------------------ */
/* archive fixtures                                                    */
/* ------------------------------------------------------------------ */

const zip = (name: string, files: Record<string, Uint8Array>): ZipSource => ({
  name,
  bytes: zipSync(files),
});

/** Deterministic "png" bytes — content differs per seed. */
const png = (seed: string) => strToU8(`PNG-${seed}`);

const nftMeta = (tokenId: number, traits: Record<string, string>) =>
  strToU8(
    JSON.stringify({
      name: `Otter #${tokenId}`,
      description: "An otter",
      image: `${tokenId}.png`,
      edition: tokenId,
      attributes: Object.entries(traits).map(([trait_type, value]) => ({ trait_type, value })),
    }),
  );

/** Builds one `otters-a-b.zip` batch with sequential token ids. */
function batchZip(
  name: string,
  from: number,
  to: number,
  opts: { sameArt?: boolean } = {},
): ZipSource {
  const root = name.replace(/\.zip$/i, "");
  const files: Record<string, Uint8Array> = {};
  for (let id = from; id <= to; id += 1) {
    files[`${root}/images/${id}.png`] = png(opts.sameArt ? "shared" : `${id}`);
    files[`${root}/metadata/${id}.json`] = nftMeta(id, {
      Background: id % 2 === 0 ? "Blue" : "Gold",
      Eyes: id % 5 === 0 ? "Laser" : "Plain",
    });
  }
  return zip(name, files);
}

const collectionZip = () =>
  zip("metadata.zip", {
    "metadata/metadata.json": strToU8(
      JSON.stringify({
        name: "Otters",
        symbol: "OTTR",
        description: "A raft of otters",
        image: "cover.png",
        external_url: "https://otters.example",
      }),
    ),
  });

/* ------------------------------------------------------------------ */
/* tests                                                               */
/* ------------------------------------------------------------------ */

await test("collection metadata archive is located and parsed", async () => {
  const collection = await readCollectionMetadataZip(collectionZip());
  assert(collection.valid, "collection metadata should be valid");
  assert(
    collection.sourceFile === "metadata/metadata.json",
    `unexpected source ${collection.sourceFile}`,
  );
  assert(collection.name === "Otters", "name should be read");
  assert(collection.symbol === "", "symbol is launch-owned and should not be read");
  assert(collection.externalUrl === "https://otters.example", "external url should be read");
});

await test("a collection archive without metadata.json fails with an error", async () => {
  const result = await readCollectionMetadataZip(
    zip("metadata.zip", { "readme.txt": strToU8("nope") }),
  );
  assert(!result.valid, "archive without metadata should be invalid");
  assert(
    result.issues.some((i) => i.code === "ZIP_STRUCTURE" && i.severity === "error"),
    "expected a ZIP_STRUCTURE error",
  );
});

await test("an unreadable archive reports an error instead of throwing", async () => {
  const result = await readCollectionMetadataZip({
    name: "broken.zip",
    bytes: strToU8("not a zip at all"),
  });
  assert(!result.valid, "broken archive should be invalid");
  assert(
    result.issues.some((i) => i.severity === "error"),
    "expected an error issue",
  );
});

await test("a batch archive pairs images with metadata", async () => {
  const batch = await inspectNftBatch(batchZip("otters-1-10.zip", 1, 10));
  assert(batch.valid, `batch should be valid: ${batch.issues.map((i) => i.message).join(", ")}`);
  assert(batch.records.length === 10, `expected 10 records, got ${batch.records.length}`);
  assert(batch.images.length === 10, `expected 10 images, got ${batch.images.length}`);
  assert(
    batch.tokenIds.length === 10 && batch.tokenIds[0] === 1,
    "token ids should come from the metadata",
  );
});

await test("a batch archive missing the required folders is rejected", async () => {
  const batch = await inspectNftBatch(zip("otters-bad.zip", { "otters-bad/1.png": png("1") }));
  assert(!batch.valid, "batch without images/metadata folders should be invalid");
  assert(
    batch.issues.some((i) => i.code === "ZIP_STRUCTURE" && i.severity === "warning"),
    "expected a ZIP_STRUCTURE warning about the expected folders",
  );
  assert(
    batch.issues.some((i) => i.code === "NO_METADATA" && i.severity === "error"),
    "expected a NO_METADATA error",
  );
});

await test("multiple batches import as one collection with one rarity ranking", async () => {
  const result = await importZipPackage({
    collectionZip: collectionZip(),
    batchZips: [batchZip("otters-1-100.zip", 1, 100), batchZip("otters-101-200.zip", 101, 200)],
  });

  assert(result.batches.length === 2, "both batches should be inspected");
  assert(
    result.report.statistics.totalNfts === 200,
    `expected 200 NFTs, got ${result.report.statistics.totalNfts}`,
  );
  assert(result.report.statistics.matchedImages === 200, "every NFT should have matched artwork");
  assert(result.report.statistics.missingImages === 0, "no NFT should be missing artwork");
  assert(
    result.report.ready,
    `import should be ready: ${result.report.issues.map((i) => i.message).join(", ")}`,
  );

  const ranks = [...result.report.nfts].map((nft) => nft.rarityRank).sort((a, b) => a - b);
  assert(
    ranks[0] === 1 && ranks[ranks.length - 1] === 200,
    "ranks should span the whole collection",
  );
  assert(new Set(ranks).size === 200, "ranks should be unique across batches");
  assert(result.crossBatchDuplicateTokenIds.length === 0, "no duplicate token ids expected");
});

await test("token ids duplicated across batches block the import", async () => {
  const result = await importZipPackage({
    batchZips: [batchZip("otters-1-10.zip", 1, 10), batchZip("otters-overlap.zip", 5, 14)],
  });

  assert(result.crossBatchDuplicateTokenIds.length > 0, "overlap should be detected");
  assert(result.crossBatchDuplicateTokenIds.includes(5), "token id 5 should be flagged");
  assert(!result.report.ready, "an overlapping import must not be ready");
});

await test("identical artwork under different filenames is detected by hash", async () => {
  const result = await importZipPackage({
    batchZips: [batchZip("otters-1-4.zip", 1, 4, { sameArt: true })],
  });
  assert(
    result.duplicateArtwork.length === 1,
    `expected 1 duplicate group, got ${result.duplicateArtwork.length}`,
  );
  const group = result.duplicateArtwork[0]!;
  assert(group.filenames.length === 4, "all four filenames should be grouped");
  assert(group.hash === mockFileHash(png("shared")), "group hash should match the file hash");
  assert(
    result.report.issues.some((i) => i.code === "DUPLICATE_IMAGE_HASH" && i.severity === "warning"),
    "duplicate artwork should warn, not block",
  );
  assert(result.report.ready, "duplicate artwork alone must not block the import");
});

await test("NFTExport.io filenames containing # match exactly", async () => {
  const root = "otters-outbreak-1-3";
  const files: Record<string, Uint8Array> = {};
  for (let id = 1; id <= 3; id += 1) {
    files[`${root}/images/otter-#${id}.png`] = png(`${id}`);
    files[`${root}/metadata/OTTER #${id}.json`] = strToU8(
      JSON.stringify({
        name: `OTTER #${id}`,
        description: "An otter",
        image: `otter-#${id}.png`,
        edition: id,
        attributes: [{ trait_type: "Background", value: "bubblegum aqua.PNG" }],
      }),
    );
  }
  const batch = await inspectNftBatch(zip(`${root}.zip`, files));
  assert(batch.valid, `batch should be valid: ${batch.issues.map((i) => i.message).join(", ")}`);
  assert(batch.matchedCount === 3, `expected 3 matched, got ${batch.matchedCount}`);
  assert(batch.orphanImages.length === 0, `expected 0 orphans, got ${batch.orphanImages.length}`);
  assert(batch.missingImages.length === 0, "expected 0 missing");
  assert(batch.duplicateTokenIds.length === 0, "expected 0 duplicate ids");
});

/* ------------------------------------------------------------------ */

const passed = results.filter((r) => r.ok).length;
for (const result of results) {
  console.log(result.ok ? `PASS  ${result.name}` : `FAIL  ${result.name}\n      ${result.error}`);
}
console.log(`\n${passed}/${results.length} passed`);
if (passed !== results.length) process.exit(1);
