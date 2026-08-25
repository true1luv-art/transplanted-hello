/**
 * Observed trait frequencies across a collection's population.
 *
 * Imported and chain-minted tokens carry no creator-configured weights, so a
 * trait's probability is derived from how often that value occurs in the
 * collection (count / total). Display only — never used for generation.
 */
import type { NFTAttribute } from "@/features/lib/metadata";

export const traitProbabilityKey = (trait: string, value: string | number) =>
  `${trait}\u0000${String(value)}`;

export function buildTraitProbabilities(
  population: { attributes?: NFTAttribute[] | undefined }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  let total = 0;
  for (const item of population) {
    if (!item.attributes?.length) continue;
    total += 1;
    for (const attribute of item.attributes) {
      const key = traitProbabilityKey(attribute.trait_type, attribute.value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const probabilities = new Map<string, number>();
  if (total === 0) return probabilities;
  for (const [key, count] of counts) probabilities.set(key, count / total);
  return probabilities;
}
