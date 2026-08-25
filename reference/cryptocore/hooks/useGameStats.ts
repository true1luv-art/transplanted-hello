import { useMemo } from "react";

import { claimCharges, raidCharges, type ChargeSnapshot } from "@/features/game/charges";
import {
  decayMultiplier,
  miningPerSecond,
  secondsUntilFull,
  vaultCapacity,
  vaultFillPercent,
} from "@/features/game/mining";
import { derivedBaseStats, totalStats } from "@/features/game/stats";
import { usePlayerStore } from "@/features/stores/playerStore";
import { pickEquippedItems, useEquipmentStore } from "@/features/stores/equipmentStore";
import { useNow } from "@/hooks/useNow";
import type { Equipment, StatBlock } from "@/features/types/game";

export interface GameSnapshot {
  base: StatBlock;
  /** Raw upgrade levels (used for costs); `base` holds the scaled values. */
  levels: StatBlock;
  total: StatBlock;
  equippedItems: Equipment[];
  wallet: number;
  vault: number;
  vaultStaked: number;
  capacity: number;
  vaultSpace: number;
  fillPercent: number;
  perSecond: number;
  secondsToFull: number | null;
  isFull: boolean;
  decay: number;
  claims: ChargeSnapshot;
  raids: ChargeSnapshot;
  notoriety: number;
}

/** Derived, read-only view of the whole game state. */
export const useGameStats = (): GameSnapshot => {
  const wallet = usePlayerStore((state) => state.wallet);
  const vault = usePlayerStore((state) => state.vault);
  const vaultStaked = usePlayerStore((state) => state.vaultStaked);
  const statLevels = usePlayerStore((state) => state.statLevels);
  const notoriety = usePlayerStore((state) => state.notoriety);
  const lastSinkAt = usePlayerStore((state) => state.lastSinkAt);
  const claimChargeCount = usePlayerStore((state) => state.claimCharges);
  const lastClaimRegenAt = usePlayerStore((state) => state.lastClaimRegenAt);
  const raidChargeCount = usePlayerStore((state) => state.raidCharges);
  const lastRaidRegenAt = usePlayerStore((state) => state.lastRaidRegenAt);
  const inventory = useEquipmentStore((state) => state.inventory);
  const equipped = useEquipmentStore((state) => state.equipped);
  // Keeps charge countdowns and decay live even when the vault stops changing.
  const now = useNow(1000);

  return useMemo(() => {
    const equippedItems = pickEquippedItems(inventory, equipped);
    const base = derivedBaseStats(statLevels, vaultStaked, notoriety);
    const total = totalStats(base, equippedItems);
    const capacity = vaultCapacity(vaultStaked, total.hashRate);
    const decay = decayMultiplier(lastSinkAt, now);
    return {
      base,
      levels: statLevels,
      total,
      equippedItems,
      wallet,
      vault,
      vaultStaked,
      capacity,
      vaultSpace: Math.max(0, capacity - vault),
      fillPercent: vaultFillPercent(vault, capacity),
      perSecond: miningPerSecond(total.hashRate, decay),
      secondsToFull: secondsUntilFull(vault, total.hashRate, vaultStaked, decay),
      isFull: vault >= capacity,
      decay,
      notoriety,
      claims: claimCharges({ charges: claimChargeCount, lastRegenAt: lastClaimRegenAt }, now),
      raids: raidCharges(
        { charges: raidChargeCount, lastRegenAt: lastRaidRegenAt },
        lastSinkAt,
        now,
      ),
    };
  }, [
    now,
    inventory,
    equipped,
    statLevels,
    notoriety,
    wallet,
    vault,
    vaultStaked,
    lastSinkAt,
    claimChargeCount,
    lastClaimRegenAt,
    raidChargeCount,
    lastRaidRegenAt,
  ]);
};
