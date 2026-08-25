import {
  DECAY_FLOOR,
  DECAY_GRACE_DAYS,
  DECAY_PER_WEEK,
  HASHRATE_SOFTCAP,
  HASHRATE_SOFTCAP_RATE,
  MINING_MULTIPLIER,
  UPGRADE_TARGET_SECONDS,
  VAULT_BASE_CAPACITY,
} from "@/features/constants/game";

/**
 * Hash rate above the softcap only contributes at a reduced rate, so
 * runaway stacking of gear/upgrades cannot break the economy.
 */
export const effectiveHashRate = (totalHashRate: number): number => {
  const raw = Math.max(0, totalHashRate);
  if (raw <= HASHRATE_SOFTCAP) return raw;
  return HASHRATE_SOFTCAP + (raw - HASHRATE_SOFTCAP) * HASHRATE_SOFTCAP_RATE;
};

/**
 * Vault capacity scales with the rig itself, so a full vault always represents
 * a comparable number of hours of mining no matter how big the rig gets.
 */
export const vaultCapacity = (vaultStaked: number, _totalHashRate = 0): number => {
  return Math.round(VAULT_BASE_CAPACITY + Math.max(0, vaultStaked));
};

/**
 * Idle decay: mining slows down when the player stops sinking HASH back
 * into the rig (upgrades and chest purchases count as sinks; claims do not).
 */
export const decayMultiplier = (
  lastSinkAt: number | null | undefined,
  now = Date.now(),
): number => {
  if (!lastSinkAt) return 1;
  const daysSince = Math.max(0, (now - lastSinkAt) / 86_400_000);
  if (daysSince <= DECAY_GRACE_DAYS) return 1;
  const weeks = Math.floor((daysSince - DECAY_GRACE_DAYS) / 7);
  return Math.max(Math.pow(DECAY_PER_WEEK, weeks), DECAY_FLOOR);
};

/**
 * HASH mined per second — TerraCore formula:
 *   mineRate = (effectiveHashRate + 1)² ÷ UPGRADE_TARGET_SECONDS
 * where UPGRADE_TARGET_SECONDS = 172,800 (48 h), so at level 1 you earn
 * exactly enough to afford the next upgrade in ~2 days.
 */
export const miningPerSecond = (totalHashRate: number, decay = 1): number => {
  const effective = effectiveHashRate(totalHashRate);
  return (
    (Math.pow(effective + 1, 2) / UPGRADE_TARGET_SECONDS) * MINING_MULTIPLIER * Math.max(0, decay)
  );
};

export const vaultFillPercent = (vault: number, capacity: number): number =>
  capacity <= 0 ? 0 : Math.min(100, (vault / capacity) * 100);

/**
 * Milliseconds until the next decay step (either the end of the grace period
 * or the next weekly step). Null once the decay floor is reached.
 */
export const msUntilNextDecayStep = (
  lastSinkAt: number | null | undefined,
  now = Date.now(),
): number | null => {
  if (!lastSinkAt) return null;
  const graceEnd = lastSinkAt + DECAY_GRACE_DAYS * 86_400_000;
  if (now < graceEnd) return graceEnd - now;
  if (decayMultiplier(lastSinkAt, now) <= DECAY_FLOOR) return null;
  const weeks = Math.floor((now - graceEnd) / (7 * 86_400_000));
  return graceEnd + (weeks + 1) * 7 * 86_400_000 - now;
};

export const isVaultFull = (vault: number, capacity: number): boolean => vault >= capacity;

export interface MiningTickResult {
  vault: number;
  mined: number;
  becameFull: boolean;
}

/** Advance the vault by `seconds` of mining, clamped to capacity. */
export const applyMining = (
  vault: number,
  totalHashRate: number,
  vaultLevel: number,
  seconds: number,
  decay = 1,
): MiningTickResult => {
  const capacity = vaultCapacity(vaultLevel, totalHashRate);
  if (vault >= capacity) return { vault: capacity, mined: 0, becameFull: false };

  const gross = miningPerSecond(totalHashRate, decay) * Math.max(0, seconds);
  const next = Math.min(capacity, vault + gross);
  return {
    vault: next,
    mined: next - vault,
    becameFull: next >= capacity && vault < capacity,
  };
};

/** Seconds to fill the remaining vault space at the current rate. */
export const secondsUntilFull = (
  vault: number,
  totalHashRate: number,
  vaultLevel: number,
  decay = 1,
): number | null => {
  const rate = miningPerSecond(totalHashRate, decay);
  if (rate <= 0) return null;
  const remaining = vaultCapacity(vaultLevel, totalHashRate) - vault;
  if (remaining <= 0) return 0;
  return remaining / rate;
};
