import type { ChestKey, Rarity, SlotKey, StatKey } from "@/features/types/game";

export const STAT_KEYS: StatKey[] = [
  "hashRate",
  "hackPower",
  "security",
  "luck",
  "firewall",
  "exploit",
];

export const STAT_META: Record<StatKey, { label: string; description: string; icon: string }> = {
  hashRate: {
    label: "Hash Rate",
    description: "HASH mined per second.",
    icon: "Cpu",
  },
  hackPower: {
    label: "Hack Power",
    description: "Improves your raid success chance.",
    icon: "Swords",
  },
  security: {
    label: "Security",
    description: "Defends your vault against raiders.",
    icon: "ShieldCheck",
  },
  luck: {
    label: "Luck",
    description: "Nudges chest rolls toward higher rarity.",
    icon: "Clover",
  },
  firewall: {
    label: "Firewall",
    description: "Chance to block an incoming raid outright.",
    icon: "Flame",
  },
  exploit: {
    label: "Exploit",
    description: "Minimum percentage stolen on a successful raid.",
    icon: "Bug",
  },
};

export const SLOT_KEYS: SlotKey[] = [
  "asicMiner",
  "motherboard",
  "powerSupply",
  "coolingSystem",
  "networkModule",
  "firmwareChip",
];

export const SLOT_META: Record<SlotKey, { label: string; icon: string }> = {
  asicMiner: { label: "ASIC Miner", icon: "Cpu" },
  motherboard: { label: "Motherboard", icon: "CircuitBoard" },
  powerSupply: { label: "Power Supply", icon: "Zap" },
  coolingSystem: { label: "Cooling System", icon: "Fan" },
  networkModule: { label: "Network Module", icon: "Network" },
  firmwareChip: { label: "Firmware Chip", icon: "Microchip" },
};

export const RARITY_KEYS: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_META: Record<
  Rarity,
  { label: string; min: number; max: number; textClass: string; ringClass: string; bgClass: string }
> = {
  common: {
    label: "Common",
    min: 1,
    max: 10,
    textClass: "text-rarity-common",
    ringClass: "ring-rarity-common/40",
    bgClass: "bg-rarity-common/15",
  },
  uncommon: {
    label: "Uncommon",
    min: 2,
    max: 20,
    textClass: "text-rarity-uncommon",
    ringClass: "ring-rarity-uncommon/40",
    bgClass: "bg-rarity-uncommon/15",
  },
  rare: {
    label: "Rare",
    min: 3,
    max: 30,
    textClass: "text-rarity-rare",
    ringClass: "ring-rarity-rare/40",
    bgClass: "bg-rarity-rare/15",
  },
  epic: {
    label: "Epic",
    min: 4,
    max: 50,
    textClass: "text-rarity-epic",
    ringClass: "ring-rarity-epic/40",
    bgClass: "bg-rarity-epic/15",
  },
  legendary: {
    label: "Legendary",
    min: 6,
    max: 60,
    textClass: "text-rarity-legendary",
    ringClass: "ring-rarity-legendary/40",
    bgClass: "bg-rarity-legendary/15",
  },
};

/** Number of rolled stats per rarity. Epic is a 50/50 between 4 and 5. */
export const RARITY_STAT_COUNT: Record<Rarity, number | [number, number]> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: [4, 5],
  legendary: 6,
};

export const CHESTS: Record<
  ChestKey,
  { label: string; price: number; blurb: string; icon: string }
> = {
  common: {
    label: "Common Chest",
    price: 5000,
    blurb: "Salvaged parts from an abandoned farm.",
    icon: "Package",
  },
  uncommon: {
    label: "Uncommon Chest",
    price: 15000,
    blurb: "Retired hardware with life left in it.",
    icon: "Boxes",
  },
  rare: {
    label: "Rare Chest",
    price: 25000,
    blurb: "Grade-A rigs pulled from a live data center.",
    icon: "Gift",
  },
  epic: {
    label: "Epic Chest",
    price: 2000,
    blurb: "Overclocked gear, cooled to the limit.",
    icon: "Gem",
  },
  legendary: {
    label: "Legendary Chest",
    price: 5000,
    blurb: "Whale-tier loot. The best odds in the network.",
    icon: "Crown",
  },
};

export const CHEST_KEYS: ChestKey[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Chests players can actually buy. Epic and Legendary chests are disabled for now. */
export const PURCHASABLE_CHEST_KEYS: ChestKey[] = ["common", "uncommon", "rare"];

export const VAULT_BASE_CAPACITY = 1;
export const VAULT_CAPACITY_PER_LEVEL = 1;
export const MINING_MULTIPLIER = 1;
export const RIVAL_COUNT = 20;
export const MAX_ACTIVITY_ENTRIES = 30;

/* ---------------- Mining economy ---------------- */

/** Hash rate above this contributes at HASHRATE_SOFTCAP_RATE per point. */
export const HASHRATE_SOFTCAP = 333;
export const HASHRATE_SOFTCAP_RATE = 0.5;

/** Mining is calibrated so the next upgrade is affordable in ~48h. */
export const UPGRADE_TARGET_SECONDS = 48 * 60 * 60;

/** Idle decay: full rate for 14 days, then -10%/week down to a 25% floor. */
export const DECAY_GRACE_DAYS = 14;
export const DECAY_PER_WEEK = 0.9;
export const DECAY_FLOOR = 0.25;

/* ---------------- Charges ---------------- */

export const MAX_CLAIM_CHARGES = 5;
export const MAX_RAID_CHARGES = 8;
/** One charge regenerates every 4 hours. */
export const CHARGE_REGEN_MS = 4 * 60 * 60 * 1000;
/** Marketplace fee charged on player-to-player sales, in basis points. */
export const MARKET_FEE_BPS = 500; // 5%

export const RAID_CHARGE_DECAY_DAYS = 5;

/* ---------------- Raiding ---------------- */

/** A rival cannot be raided again within this window. */
export const RIVAL_RAID_COOLDOWN_MS = 60 * 1000;

/* ---------------- Loot ---------------- */

/** Rarity index used by the loot value formula. */
export const RARITY_INDEX: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 6,
};

/**
 * Chest rarity ladders (upgrade ladder model from the reference game).
 * A roll of 0–99,999 walks the ladder; the first entry it fits decides rarity.
 *
 * Odds mirror the Mythoria/TerraCore crate tables:
 *   Common    crate: 90% common, 9% uncommon, 0.75% rare, 0.20% epic, 0.05% legendary
 *   Uncommon  crate: 95% uncommon, 4% rare, 0.90% epic, 0.10% legendary
 *   Rare      crate: 95% rare, 4% epic, 1% legendary
 *   Epic      crate: 98% epic, 2% legendary
 *   Legendary crate: 100% legendary
 */
export const CHEST_LADDERS: Record<ChestKey, { max: number; rarity: Rarity }[]> = {
  common: [
    { max: 90_000, rarity: "common" },
    { max: 99_000, rarity: "uncommon" },
    { max: 99_750, rarity: "rare" },
    { max: 99_950, rarity: "epic" },
    { max: Infinity, rarity: "legendary" },
  ],
  uncommon: [
    { max: 95_000, rarity: "uncommon" },
    { max: 99_000, rarity: "rare" },
    { max: 99_900, rarity: "epic" },
    { max: Infinity, rarity: "legendary" },
  ],
  rare: [
    { max: 95_000, rarity: "rare" },
    { max: 99_000, rarity: "epic" },
    { max: Infinity, rarity: "legendary" },
  ],
  epic: [
    { max: 98_000, rarity: "epic" },
    { max: Infinity, rarity: "legendary" },
  ],
  legendary: [{ max: Infinity, rarity: "legendary" }],
};

/** Percentage odds per rarity, derived from each chest's ladder. */
export const CHEST_ODDS: Record<ChestKey, Record<Rarity, number>> = CHEST_KEYS.reduce(
  (acc, chest) => {
    const odds = RARITY_KEYS.reduce(
      (map, rarity) => ({ ...map, [rarity]: 0 }),
      {} as Record<Rarity, number>,
    );
    let previous = 0;
    for (const step of CHEST_LADDERS[chest]) {
      const max = Number.isFinite(step.max) ? step.max : 100_000;
      odds[step.rarity] += Math.round(((max - previous) / 1000) * 100) / 100;
      previous = max;
    }
    return { ...acc, [chest]: odds };
  },
  {} as Record<ChestKey, Record<Rarity, number>>,
);
