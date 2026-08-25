// src/lib/modules/players/model.server.ts
import mongoose, { Schema, type Model } from "mongoose";
import type { IPlayer } from "./types.server";

const StatBlockSchema = new Schema(
  {
    hashRate: { type: Number, default: 0 },
    hackPower: { type: Number, default: 0 },
    security: { type: Number, default: 0 },
    luck: { type: Number, default: 0 },
    firewall: { type: Number, default: 0 },
    exploit: { type: Number, default: 0 },
  },
  { _id: false },
);

/** Computed effective stats (statLevels + item bonuses). Updated server-side on tick/upgrade/equip. */
const StatsComputedSchema = new Schema(
  {
    hashRate: { type: Number, default: 1 },
    hackPower: { type: Number, default: 1 },
    security: { type: Number, default: 1 },
    luck: { type: Number, default: 1 },
    firewall: { type: Number, default: 1 },
    exploit: { type: Number, default: 1 },
  },
  { _id: false },
);

/** Equipped cosmetic references — ObjectId pointers into the assets collection. */
const ProfileSchema = new Schema(
  {
    avatar: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    banner: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    background: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
  },
  { _id: false },
);

/** Equipped gear references — ObjectId pointers into the items collection, one per slot. */
const EquipmentSchema = new Schema(
  {
    asicMiner: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    motherboard: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    powerSupply: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    coolingSystem: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    networkModule: { type: Schema.Types.ObjectId, ref: "Item", default: null },
    firmwareChip: { type: Schema.Types.ObjectId, ref: "Item", default: null },
  },
  { _id: false },
);

const EMPTY_EQUIPMENT = () => ({
  asicMiner: null,
  motherboard: null,
  powerSupply: null,
  coolingSystem: null,
  networkModule: null,
  firmwareChip: null,
});

const MilestonesSchema = new Schema(
  {
    totalClaimed: { type: Number, default: 0 },
    totalMined: { type: Number, default: 0 },
    raids: { type: Number, default: 0 },
    raidWins: { type: Number, default: 0 },
    totalStolen: { type: Number, default: 0 },
    bestHashRate: { type: Number, default: 1 },
  },
  { _id: false },
);

const PlayerSchema = new Schema<IPlayer>(
  {
    wallet: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    registrationTime: { type: Number, default: () => Date.now() },

    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },

    hash: { type: Number, default: 0 },
    sparks: { type: Number, default: 0 },
    vault: { type: Number, default: 0 },
    vaultStaked: { type: Number, default: 0 },
    notoriety: { type: Number, default: 0 },
    totalBurned: { type: Number, default: 0 },

    statLevels: {
      type: StatBlockSchema,
      default: () => ({
        hashRate: 1,
        hackPower: 1,
        security: 1,
        luck: 1,
        firewall: 1,
        exploit: 1,
      }),
    },

    /** Computed effective stats (base levels + item bonuses). Updated server-side. */
    stats: {
      type: StatsComputedSchema,
      default: () => ({
        hashRate: 1,
        hackPower: 1,
        security: 1,
        luck: 1,
        firewall: 1,
        exploit: 1,
      }),
    },

    lastTickAt: { type: Number, default: () => Date.now() },
    lastSinkAt: { type: Number, default: () => Date.now() },
    claimCharges: { type: Number, default: 5 },
    lastClaimRegenAt: { type: Number, default: () => Date.now() },
    raidCharges: { type: Number, default: 8 },
    lastRaidRegenAt: { type: Number, default: () => Date.now() },

    /** Timestamp of the last successful stat upgrade (ms). */
    lastUpgradeTime: { type: Number, default: 0 },

    /** Per-raid cooldown expiry (ms). Raids blocked until Date.now() > raidCooldown. */
    raidCooldown: { type: Number, default: 0 },

    milestones: {
      type: MilestonesSchema,
      default: () => ({
        totalClaimed: 0,
        totalMined: 0,
        raids: 0,
        raidWins: 0,
        totalStolen: 0,
        bestHashRate: 1,
      }),
    },

    profile: {
      type: ProfileSchema,
      default: () => ({ avatar: null, banner: null, background: null }),
    },

    equipment: { type: EquipmentSchema, default: EMPTY_EQUIPMENT },

    protectionUntil: { type: Number, default: 0 },

    /** Notoriety-gated withdrawal tracking. */
    withdrawnToday: { type: Number, default: 0 }, // HASH withdrawn in the current 24-hour window
    withdrawResetAt: { type: Number, default: 0 }, // epoch ms when withdrawnToday resets

    /** Referral system */
    referredBy: { type: String, default: null }, // wallet of the player who referred this player
    referralCount: { type: Number, default: 0 }, // how many players this player has referred
    referralEarned: { type: Number, default: 0 }, // cumulative HASH earned from referral cuts

    /** Optimistic-lock / anti-cheat mutation counter. Increments on every write. */
    version: { type: Number, default: 0 },
  },
  { collection: "players", timestamps: true },
);

export const PlayerModel: Model<IPlayer> =
  (mongoose.models["Player"] as Model<IPlayer>) ?? mongoose.model<IPlayer>("Player", PlayerSchema);
