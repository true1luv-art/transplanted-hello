// src/lib/game/raid.server.ts
import type { IPlayer } from "@/lib/modules/players/types.server";
import {
  MAX_CLAIM_CHARGES,
  MAX_RAID_CHARGES,
  CHARGE_REGEN_MS,
  RAID_CHARGE_DECAY_DAYS,
  RIVAL_RAID_COOLDOWN_MS,
} from "@/features/constants/game";
import { createLog } from "@/lib/modules/logs/repository.server";
import { vaultCapacity } from "@/features/game/mining";
import { createSeededRng, generateServerSeed } from "./rng";

export function regenCharges(player: IPlayer): IPlayer {
  const now = Date.now();
  const addClaims = Math.floor((now - player.lastClaimRegenAt) / CHARGE_REGEN_MS);
  const addRaids = Math.floor((now - player.lastRaidRegenAt) / CHARGE_REGEN_MS);

  if (addClaims > 0) {
    player.claimCharges = Math.min(MAX_CLAIM_CHARGES, player.claimCharges + addClaims);
    player.lastClaimRegenAt = now;
  }
  if (addRaids > 0) {
    player.raidCharges = Math.min(MAX_RAID_CHARGES, player.raidCharges + addRaids);
    player.lastRaidRegenAt = now;
  }
  return player;
}

export interface RaidResult {
  success: boolean;
  reason: "success" | "blocked" | "failed" | "outmatched";
  chance: number;
  stealPercent: number;
  stolen: number;
  xp: number;
}

export function calculateRaidChance(attacker: IPlayer, defender: IPlayer): number {
  const attack = attacker.statLevels.hackPower + attacker.statLevels.exploit;
  const defense = defender.statLevels.security + defender.statLevels.firewall;
  const base = 0.5;
  const diff = (attack - defense) / 100;
  return Math.min(0.95, Math.max(0.05, base + diff));
}

export function simulateRaid(
  attacker: IPlayer,
  defender: IPlayer,
  clientSeed: string,
): RaidResult & { serverSeed: string } {
  if (defender.protectionUntil > Date.now()) {
    return {
      success: false,
      reason: "blocked",
      chance: 0,
      stealPercent: 0,
      stolen: 0,
      xp: 0,
      serverSeed: "",
    };
  }

  const chance = calculateRaidChance(attacker, defender);
  // The response echoes `chance` back to the client, and this rng is a
  // public/reproducible hash+LCG (see rng.ts) — so if the seed were purely
  // client-supplied, an attacker who knows both wallets (always true; they
  // choose the target) could brute-force seeds offline until one rolls
  // <= chance, guaranteeing a win, and maximize the second roll below for
  // stealPercent too. Mixing in a server seed generated after the request
  // is accepted (never returned to the client) removes that predictability
  // while keeping the client seed as an auditable input (logged below).
  const serverSeed = generateServerSeed();
  const rng = createSeededRng(`${attacker.wallet}:${defender.wallet}:${clientSeed}:${serverSeed}`);
  const roll = rng();
  const success = roll <= chance;

  if (!success) {
    return {
      success: false,
      reason: "failed",
      chance,
      stealPercent: 0,
      stolen: 0,
      xp: 0,
      serverSeed,
    };
  }

  const minSteal = Math.max(0.05, attacker.statLevels.exploit / 100);
  const maxSteal = Math.min(0.5, 0.1 + attacker.statLevels.hackPower / 200);
  const stealPercent = minSteal + rng() * (maxSteal - minSteal);
  // Full roll against the defender's vault — this always leaves the
  // defender, regardless of how much of it the attacker has room to keep.
  const takenFromVault = Math.floor(defender.vault * stealPercent);

  // Credited amount is capped by the attacker's own free vault space. Any
  // excess above that cap is destroyed — it is NOT left behind with the
  // defender, and the defender's stats are never touched by a raid.
  const freeSpace = Math.max(0, vaultCapacity(attacker.vaultStaked) - attacker.vault);
  const stolen = Math.min(takenFromVault, freeSpace);

  // Mutate player state. raidCharges is intentionally NOT decremented here
  // — it is reserved atomically in the DB via reserveRaidCharge() before
  // simulateRaid() is ever called, so this function only needs to record
  // the outcome of the attempt.
  attacker.vault += stolen;
  attacker.milestones.raids += 1;
  attacker.milestones.raidWins += 1;
  attacker.milestones.totalStolen += stolen;
  attacker.xp += 10;

  defender.vault -= takenFromVault;
  defender.protectionUntil = Date.now() + RIVAL_RAID_COOLDOWN_MS;

  return { success: true, reason: "success", chance, stealPercent, stolen, xp: 10, serverSeed };
}

export async function logRaid(
  attacker: string,
  defender: string,
  result: RaidResult,
  clientSeed: string,
  serverSeed: string,
) {
  await createLog({
    type: "raid",
    wallet: attacker,
    target: defender,
    amount: result.stolen,
    seed: clientSeed,
    data: {
      success: result.success,
      reason: result.reason,
      chance: result.chance,
      stealPercent: result.stealPercent,
      xp: result.xp,
      serverSeed, // recorded post-hoc for provable-fairness audits
    },
  });
}
