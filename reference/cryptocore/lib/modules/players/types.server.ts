// src/lib/modules/players/types.server.ts
import type { Document, Types } from "mongoose";
import type { StatBlock, SlotKey } from "@/features/types/game";

export interface IMilestones {
  totalClaimed: number;
  totalMined: number;
  raids: number;
  raidWins: number;
  totalStolen: number;
  bestHashRate: number;
}

/**
 * Equipped cosmetic references. Each field is the MongoDB _id of the equipped
 * Asset document (or null when nothing of that kind is equipped). Kept in sync
 * server-side on mint / equip / unequip.
 */
export interface IProfile {
  avatar: Types.ObjectId | null;
  banner: Types.ObjectId | null;
  background: Types.ObjectId | null;
}

/**
 * Equipped gear references. Each slot holds the MongoDB _id of the Item document
 * currently equipped in that slot (or null when the slot is empty). Kept in sync
 * server-side on equip / unequip / salvage.
 */
export type IEquipment = Record<SlotKey, Types.ObjectId | null>;

export interface IPlayer extends Document {
  wallet: string; // primary key — Solana address
  username: string; // unique display name
  registrationTime: number;

  xp: number;
  level: number;

  hash: number; // claimed / liquid HASH balance
  sparks: number; // secondary crafting currency
  vault: number; // unclaimed mined HASH
  vaultStaked: number; // HASH staked for Luck / Firewall
  notoriety: number; // permanently burned HASH → Exploit
  totalBurned: number;

  /** Raw purchased levels for each stat. */
  statLevels: StatBlock;

  /**
   * Computed effective stat values (statLevels + item bonuses).
   * Updated on every tick, upgrade, or item equip — read O(1) by the tick server.
   */
  stats: StatBlock;

  lastTickAt: number;
  lastSinkAt: number;

  claimCharges: number;
  lastClaimRegenAt: number;
  raidCharges: number;
  lastRaidRegenAt: number;

  /** Timestamp of the last successful stat upgrade. */
  lastUpgradeTime: number;

  /** Per-raid cooldown expiry timestamp (ms). Raid is locked until Date.now() > raidCooldown. */
  raidCooldown: number;

  milestones: IMilestones;

  /** Equipped cosmetic asset references (avatar / banner / background). */
  profile: IProfile;

  /** Equipped gear item references, keyed by hardware slot. */
  equipment: IEquipment;

  protectionUntil: number; // opt-out shield after being raided

  /**
   * Notoriety-gated withdrawal tracking.
   * withdrawnToday resets when Date.now() > withdrawResetAt.
   */
  withdrawnToday: number; // HASH withdrawn in the current 24-hour window
  withdrawResetAt: number; // timestamp (ms) when withdrawnToday resets

  /** Referral system */
  referredBy: string | null; // wallet of the player who referred this player
  referralCount: number; // how many players this player has referred
  referralEarned: number; // cumulative HASH earned from referral cuts

  /**
   * Optimistic-lock counter — increments on every write.
   * Reject stale mutations whose version doesn't match the DB value.
   */
  version: number;

  createdAt: Date;
  updatedAt: Date;
}
