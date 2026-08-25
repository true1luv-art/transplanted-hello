import { STAT_KEYS } from "@/features/constants/game";
import { salvageValue } from "@/features/game/items";
import type { Equipment, StatBlock, StatKey, StatRoll } from "@/features/types/game";

export const emptyStatBlock = (): StatBlock => ({
  hashRate: 0,
  hackPower: 0,
  security: 0,
  luck: 0,
  firewall: 0,
  exploit: 0,
});

/**
 * Permanent-stat upgrade cost — TerraCore formula: level².
 * Mirrors the server formula in upgrade.server.ts exactly so the UI always
 * shows what will actually be charged.
 */
export const upgradeCost = (level: number): number => Math.max(1, level * level);

/**
 * Combat stats are shown on a x10 scale so gear rolls (also stored x10) add
 * up cleanly: level 1 = 10 Hack Power, a +5 gear roll makes it 15.
 */
export const COMBAT_STAT_SCALE = 10;

const SCALED_LEVEL_STATS: StatKey[] = ["hackPower", "security"];

/** Converts an upgrade level into its displayed stat value. */
export const statValueFromLevel = (key: StatKey, level: number): number =>
  SCALED_LEVEL_STATS.includes(key) ? level * COMBAT_STAT_SCALE : level;

/**
 * Total HASH cost to buy `count` upgrades starting from `fromLevel`.
 * Charges for the levels being bought INTO — fromLevel+1 .. fromLevel+count —
 * not fromLevel itself, which the player already owns. Must mirror
 * totalStatUpgradeCost() in lib/game/upgrade.server.ts exactly (that loop
 * uses `fromLevel + i` for `i = 1..count`), or the UI will quote a price
 * different from what the server actually debits.
 */
export const totalUpgradeCost = (fromLevel: number, count: number): number => {
  let total = 0;
  for (let i = 1; i <= count; i++) {
    total += upgradeCost(fromLevel + i);
  }
  return total;
};

/** Maximum whole upgrades affordable from `fromLevel` with the given wallet. */
export const maxAffordableUpgrades = (fromLevel: number, wallet: number): number => {
  let count = 0;
  let remaining = wallet;
  let level = fromLevel;
  // Cap iterations to avoid runaway loops at extreme wallets.
  while (count < 10_000) {
    const cost = upgradeCost(level + 1);
    if (remaining < cost) break;
    remaining -= cost;
    level++;
    count++;
  }
  return count;
};

/**
 * Item power score = its SPARKS salvage value, so the number on the card is
 * directly readable as "what this item is worth".
 */
export const equipmentScore = (item: Equipment): number => salvageValue(item);

export const sumStatRolls = (rolls: StatRoll[]): StatBlock => {
  const block = emptyStatBlock();
  for (const roll of rolls) {
    for (const key of STAT_KEYS) {
      block[key] += roll[key] ?? 0;
    }
  }
  return block;
};

/** Final stats = base (upgraded) stats + every equipped item's stats. */
export const totalStats = (base: StatBlock, equipped: Equipment[]): StatBlock => {
  const fromGear = sumStatRolls(equipped.map((item) => item.stats));
  const block = emptyStatBlock();
  for (const key of STAT_KEYS) {
    block[key] = base[key] + fromGear[key];
  }
  return block;
};

export const statValue = (block: StatBlock, key: StatKey): number => block[key];

/**
 * Threshold tables (Mythoria-style): the bonus locks in at each staked/burned
 * milestone. `[threshold, bonusPercent]`.
 */
export type BonusTable = [number, number][];

export const LUCK_TABLE: BonusTable = [
  [1, 0.025],
  [2, 0.05],
  [5, 0.125],
  [10, 0.25],
  [25, 0.625],
  [50, 1.25],
  [100, 2.25],
  [250, 3.281],
  [500, 4.063],
  [1000, 5.078],
  [2000, 5.469],
  [5000, 6.641],
  [10000, 7.1],
  [25000, 7.466],
  [50000, 8.002],
  [100000, 8.041],
  [250000, 8.155],
  [500000, 8.346],
  [1000000, 8.727],
  [2500000, 9.872],
  [5000000, 10.028],
];

export const FIREWALL_TABLE: BonusTable = [
  [1, 0.025],
  [2, 0.05],
  [5, 0.125],
  [10, 0.25],
  [25, 0.625],
  [50, 1.25],
  [100, 2.5],
  [250, 5.625],
  [500, 7.438],
  [1000, 9.0],
  [2000, 10.266],
  [5000, 11.438],
  [10000, 12.087],
  [25000, 12.453],
  [50000, 13.063],
  [100000, 14.284],
  [250000, 15.092],
  [500000, 15.283],
  [1000000, 15.664],
  [2500000, 16.809],
  [5000000, 17.027],
];

export const EXPLOIT_TABLE: BonusTable = [
  [1, 0.025],
  [2, 0.05],
  [5, 0.125],
  [10, 0.25],
  [25, 0.625],
  [50, 1.25],
  [100, 2.5],
  [250, 5.625],
  [500, 7.438],
  [1000, 8.125],
  [2000, 8.516],
  [5000, 9.688],
  [10000, 10.103],
  [25000, 10.469],
  [50000, 11.079],
  [100000, 12.009],
  [250000, 12.124],
  [500000, 12.315],
  [1000000, 12.696],
  [2500000, 13.84],
  [5000000, 14.027],
];

export const pctFromTable = (rows: BonusTable, value: number): number => {
  let pct = 0;
  for (const [threshold, bonus] of rows) {
    if (value >= threshold) pct = bonus;
    else break;
  }
  return pct;
};

/** Luck comes from HASH staked into the vault. */
export const luckFromVault = (vaultStaked: number): number =>
  pctFromTable(LUCK_TABLE, Math.max(0, vaultStaked));

/** Firewall also scales with staked HASH. */
export const firewallFromVault = (vaultStaked: number): number =>
  1 + pctFromTable(FIREWALL_TABLE, Math.max(0, vaultStaked));

/** Exploit is bought with permanently burned HASH (Notoriety). */
export const exploitFromNotoriety = (notoriety: number): number =>
  1 + pctFromTable(EXPLOIT_TABLE, Math.max(0, notoriety));

/** Effective base stats: upgraded levels + vault/notoriety-derived values. */
export const derivedBaseStats = (
  statLevels: StatBlock,
  vaultStaked: number,
  notoriety: number,
): StatBlock => ({
  ...statLevels,
  hackPower: statValueFromLevel("hackPower", statLevels.hackPower),
  security: statValueFromLevel("security", statLevels.security),
  luck: luckFromVault(vaultStaked),
  firewall: firewallFromVault(vaultStaked),
  exploit: exploitFromNotoriety(notoriety),
});

export const UPGRADEABLE_STAT_KEYS: StatKey[] = ["hashRate", "hackPower", "security"];
export const DERIVED_STAT_KEYS: StatKey[] = ["luck", "firewall", "exploit"];
