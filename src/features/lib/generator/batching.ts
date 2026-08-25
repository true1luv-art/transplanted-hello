/**
 * Batch splitting. Exports are always chunked at 100 NFTs per archive:
 * 250 -> 100 / 100 / 50, 600 -> 6 x 100, 601 -> 6 x 100 + 1.
 */
import { batchNameFor } from "./naming";
import type { ExportBatch, GeneratedNFT, GeneratorSettings } from "./types";

export const BATCH_SIZE = 100;

export function splitBatches(
  nfts: GeneratedNFT[],
  settings: GeneratorSettings,
  size = BATCH_SIZE,
): ExportBatch[] {
  const chunk = Math.max(1, Math.floor(size));
  const ordered = [...nfts].sort((a, b) => a.tokenId - b.tokenId);
  const batches: ExportBatch[] = [];

  for (let index = 0; index < ordered.length; index += chunk) {
    const slice = ordered.slice(index, index + chunk);
    const from = slice[0]!.tokenId;
    const to = slice[slice.length - 1]!.tokenId;
    batches.push({
      name: batchNameFor(settings, from, to),
      from,
      to,
      tokenIds: slice.map((nft) => nft.tokenId),
    });
  }

  return batches;
}
