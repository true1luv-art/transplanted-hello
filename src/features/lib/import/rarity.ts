/**
 * Rarity from IMPORTED data — never from creator-assigned weights.
 *
 *   trait frequency -> rarity score -> rarity rank -> rarity class (display)
 *
 * frequency(traitType, value) = count / totalNfts
 * rarityScore(nft)            = Σ 1 / frequency(trait)
 *
 * NFTs that lack a trait type present elsewhere in the collection are counted
 * under the synthetic value `None`, which is standard practice and keeps the
 * score comparable across tokens.
 *
 * The calculation is pure and deterministic: the same imported collection
 * always produces the same scores, ranks and classes.
 */
import { config } from "@/lib/config/config";
import type { ParsedMetadataRecord, TraitTypeStat, TraitValueStat } from "./types";

export const MISSING_TRAIT_VALUE = "None";

const traitKey = (traitType: string, value: string) => `${traitType}\u0000${value}`;

export interface FrequencyTable {
  totalNfts: number;
  traitTypes: string[];
  /** `${traitType}\0${value}` -> count */
  counts: Map<string, number>;
}

export function buildFrequencyTable(
  records: Pick<ParsedMetadataRecord, "attributes">[],
): FrequencyTable {
  const traitTypes: string[] = [];
  const seenTypes = new Set<string>();
  for (const record of records) {
    for (const attribute of record.attributes) {
      if (!seenTypes.has(attribute.trait_type)) {
        seenTypes.add(attribute.trait_type);
        traitTypes.push(attribute.trait_type);
      }
    }
  }

  const counts = new Map<string, number>();
  for (const record of records) {
    const present = new Map<string, string>();
    for (const attribute of record.attributes)
      present.set(attribute.trait_type, String(attribute.value));
    for (const traitType of traitTypes) {
      const value = present.get(traitType) ?? MISSING_TRAIT_VALUE;
      const key = traitKey(traitType, value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return { totalNfts: records.length, traitTypes, counts };
}

export function traitFrequency(table: FrequencyTable, traitType: string, value: string): number {
  if (table.totalNfts === 0) return 0;
  return (table.counts.get(traitKey(traitType, value)) ?? 0) / table.totalNfts;
}

/** Σ 1 / frequency across every trait type in the collection. */
export function calculateRarityScore(
  table: FrequencyTable,
  record: Pick<ParsedMetadataRecord, "attributes">,
): number {
  const present = new Map<string, string>();
  for (const attribute of record.attributes)
    present.set(attribute.trait_type, String(attribute.value));
  let score = 0;
  for (const traitType of table.traitTypes) {
    const frequency = traitFrequency(
      table,
      traitType,
      present.get(traitType) ?? MISSING_TRAIT_VALUE,
    );
    if (frequency > 0) score += 1 / frequency;
  }
  return Number(score.toFixed(6));
}

/** Per-trait contribution, used by the UI breakdown. */
export function traitContribution(table: FrequencyTable, traitType: string, value: string): number {
  const frequency = traitFrequency(table, traitType, value);
  return frequency > 0 ? Number((1 / frequency).toFixed(4)) : 0;
}

export function traitStatistics(table: FrequencyTable): TraitTypeStat[] {
  return table.traitTypes.map((traitType) => {
    const values: TraitValueStat[] = [];
    for (const [key, count] of table.counts) {
      const [type, value] = key.split("\u0000");
      if (type !== traitType) continue;
      values.push({
        traitType,
        value: value ?? "",
        count,
        frequency: table.totalNfts ? count / table.totalNfts : 0,
      });
    }
    values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { traitType, values, uniqueValues: values.length };
  });
}

export interface RankInput {
  tokenId: number;
  rarityScore: number;
}

export interface RankOutput {
  tokenId: number;
  rarityRank: number;
}

/** Highest score = rank 1. Ties break on the lower tokenId — deterministic. */
export function assignRanks(items: RankInput[]): Map<number, RankOutput> {
  const sorted = [...items].sort((a, b) => b.rarityScore - a.rarityScore || a.tokenId - b.tokenId);
  const total = sorted.length;
  const out = new Map<number, RankOutput>();
  sorted.forEach((item, index) => {
    out.set(item.tokenId, {
      tokenId: item.tokenId,
      rarityRank: index + 1,
    });
  });
  return out;
}
