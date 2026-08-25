export type StatKey = "hashRate" | "hackPower" | "security" | "luck" | "firewall" | "exploit";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type SlotKey =
  "asicMiner" | "motherboard" | "powerSupply" | "coolingSystem" | "networkModule" | "firmwareChip";

export type StatBlock = Record<StatKey, number>;
export type StatRoll = Partial<Record<StatKey, number>>;

export interface Equipment {
  id: string;
  name: string;
  slot: SlotKey;
  rarity: Rarity;
  stats: StatRoll;
  level: number;
  equipped: boolean;
  createdAt: number;
}

export type ChestKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Default soulbound template IDs assigned at player registration. */
export const DEFAULT_PLAYER_COSMETICS = {
  avatar: 0,
  banner: 100,
  background: 200,
} as const;

export interface Rival {
  id: string;
  username: string;
  avatarSeed: string;
  /** Stub Solana wallet address — links out to Solscan on the player card. */
  address: string;
  /** Profile cosmetic template IDs (numeric) — default to 0/100/200 on registration. */
  avatar: number;
  banner: number;
  background: number;
  level: number;
  claims: number;
  attacks: number;
  hashRate: number;
  vault: number;
  security: number;
  firewall: number;
  hackPower: number;
  /** Gear the rival has equipped, shown on their player card. */
  equipped: Equipment[];
  raided: boolean;
  lastRaidedAt: number | null;
}

export interface RaidOutcome {
  success: boolean;
  reason: "success" | "blocked" | "failed" | "outmatched";
  chance: number;
  stealPercent: number;
  /** Amount actually credited to the raider's vault — capped by their free vault space. */
  stolen: number;
  /**
   * Full amount removed from the target's vault, before the raider's free-space cap.
   * When this exceeds `stolen`, the difference is destroyed rather than left with the target.
   */
  takenFromVault: number;
}

export interface ActivityEntry {
  id: string;
  /** Plain-text fallback — used for demo-mode toasts and as the accessible label. */
  message: string;
  kind: "info" | "success" | "danger" | "loot";
  at: number;
  /** Optional rich rendering for `message`: an ordered set of text segments,
   *  e.g. a gear name tinted by its rarity. Falls back to `message` when absent. */
  parts?: { text: string; className?: string }[];
}
