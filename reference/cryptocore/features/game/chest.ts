import { CHEST_LADDERS, CHESTS } from "@/features/constants/game";
import { generateEquipment } from "@/features/game/equipment";
import type { ChestKey, Equipment, Rarity } from "@/features/types/game";

const LADDER_MAX = 100_000;

/**
 * Ladder-based rarity roll (reference game model): a 0–99,999 roll walks the
 * chest's ladder and the first bracket it lands in decides the rarity.
 * Luck pushes the roll upward, so it can only ever help.
 */
export const rollRarity = (chest: ChestKey, luck = 0): Rarity => {
  const ladder = CHEST_LADDERS[chest];
  const base = Math.floor(Math.random() * LADDER_MAX);
  // Luck adds up to +10% of the ladder range, tapering off as luck grows.
  const luckBonus = Math.round(LADDER_MAX * 0.1 * (1 - 1 / (1 + Math.max(0, luck) / 100)));
  const roll = Math.min(LADDER_MAX - 1, base + luckBonus);

  for (const step of ladder) {
    if (roll < step.max) return step.rarity;
  }
  return ladder[ladder.length - 1]?.rarity ?? "common";
};

export const chestPrice = (chest: ChestKey): number => CHESTS[chest].price;

/** Open a chest: random slot, ladder rarity, formula-driven stat values. */
export const openChest = (chest: ChestKey, luck = 0): Equipment =>
  generateEquipment({ rarity: rollRarity(chest, luck) });
