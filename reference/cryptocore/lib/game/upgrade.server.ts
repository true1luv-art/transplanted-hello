// src/lib/game/upgrade.server.ts
import type { IPlayer } from "@/lib/modules/players/types.server";
import { findItemByNumber, upgradeItem } from "@/lib/modules/items/repository.server";
import { debitHash, debitSparks, updatePlayer } from "@/lib/modules/players/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import { salvageValue, upgradeCost } from "@/features/game/items";
import { XP_PER_HASH, XP_PER_SPARK } from "@/features/game/level";
import type { StatRoll } from "@/features/types/game";

/**
 * Cost to upgrade one stat level — TerraCore formula: level².
 * Must stay in sync with upgradeCost() in features/game/stats.ts.
 */
export function statUpgradeCost(stat: string, level: number): number {
  return Math.max(1, level * level);
}

/**
 * Total cost to buy `levels` consecutive upgrades starting from `fromLevel + 1`.
 * Mirrors totalUpgradeCost() in features/game/stats.ts exactly.
 */
export function totalStatUpgradeCost(stat: string, fromLevel: number, levels: number): number {
  let total = 0;
  for (let i = 1; i <= levels; i++) {
    total += statUpgradeCost(stat, fromLevel + i);
  }
  return total;
}

/** Hard ceiling on a single bulk request, mirroring the client's iteration cap. */
export const MAX_BULK_UPGRADE_LEVELS = 10_000;

/**
 * Item forge cost — reference formula (`hive-engine/lib/items.js`):
 * `value * 0.0498 * item.level`, where value is the item's salvage value.
 * This MUST stay in sync with upgradeCost() in features/game/items.ts,
 * which the client uses to show the price in the upgrade dialog — a
 * mismatch here means the client shows one price and the server charges
 * another.
 */
export function itemUpgradeCost(item: { stats: StatRoll; level: number }): number {
  return upgradeCost(item);
}

/**
 * Buys `levels` stat upgrades in a single DB round trip: computes the total
 * cost for the whole batch, debits it once, and applies all levels at once.
 * This intentionally replaces any previous "call once per level" client
 * loop — buying 100 levels must never mean sending 100 requests.
 */
export async function upgradeStat(
  wallet: string,
  stat: keyof IPlayer["statLevels"],
  levels = 1,
): Promise<{ ok: boolean; cost?: number; levels?: number; error?: string }> {
  const count = Math.floor(levels);
  if (!Number.isFinite(count) || count < 1) return { ok: false, error: "Invalid level count" };
  if (count > MAX_BULK_UPGRADE_LEVELS) {
    return { ok: false, error: `Cannot buy more than ${MAX_BULK_UPGRADE_LEVELS} levels at once` };
  }

  const { findPlayerByWallet } = await import("@/lib/modules/players/repository.server");
  const player = await findPlayerByWallet(wallet);
  if (!player) return { ok: false, error: "Player not found" };

  const fromLevel = player.statLevels[stat];
  const nextLevel = fromLevel + count;
  const cost = totalStatUpgradeCost(stat, fromLevel, count);
  const { ok } = await debitHash(wallet, cost);
  if (!ok) return { ok: false, error: "Not enough HASH" };

  // Persist the new stat level, recompute the effective stats block,
  // record the upgrade timestamp, increment the version counter, and award
  // XP for the HASH sunk into this upgrade (previously missing entirely —
  // stat upgrades never granted XP, only raid wins did).
  await updatePlayer(wallet, {
    $set: {
      [`statLevels.${stat}`]: nextLevel,
      [`stats.${stat}`]: nextLevel, // effective = base (no item bonuses yet)
      lastSinkAt: Date.now(),
      lastUpgradeTime: Date.now(),
    },
    $inc: { version: 1, xp: Math.round(cost * XP_PER_HASH) },
  } as unknown as Partial<IPlayer>);

  await createLog({
    type: "stat_upgrade",
    wallet,
    amount: -cost,
    data: { stat, from: fromLevel, to: nextLevel, levels: count },
  });

  return { ok: true, cost, levels: count };
}

export async function upgradeEquipment(
  wallet: string,
  itemNumber: number,
): Promise<{ ok: boolean; cost?: number; error?: string }> {
  const item = await findItemByNumber(itemNumber);
  if (!item || item.owner !== wallet) return { ok: false, error: "Item not found" };
  const cost = itemUpgradeCost({ stats: item.stats as StatRoll, level: item.level });
  const { ok } = await debitSparks(wallet, cost);
  if (!ok) return { ok: false, error: "Not enough SPARKS" };

  const previousSpark = salvageValue({ stats: item.stats as StatRoll, level: item.level });

  const result = await upgradeItem(itemNumber, wallet);
  if (!result.ok) return result;

  // Award XP for the SPARK value the upgrade added to the item — the gap
  // between its salvage value before and after the stat bump — not the
  // SPARKS spent on the upgrade itself.
  const currentSpark = salvageValue({
    stats: result.item!.stats as StatRoll,
    level: result.item!.level,
  });
  const xpGain = Math.round(Math.max(0, currentSpark - previousSpark) * XP_PER_SPARK);
  if (xpGain > 0) {
    await updatePlayer(wallet, { $inc: { xp: xpGain } });
  }

  await createLog({
    type: "upgrade",
    wallet,
    amount: -cost,
    data: { itemNumber, name: item.name, from: item.level, to: item.level + 1 },
  });

  return { ok: true, cost };
}
