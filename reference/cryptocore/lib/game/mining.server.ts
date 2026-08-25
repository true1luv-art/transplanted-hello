// src/lib/game/mining.server.ts
import type { IPlayer } from "@/lib/modules/players/types.server";
import {
  effectiveHashRate,
  miningPerSecond,
  vaultCapacity,
  decayMultiplier,
} from "@/features/game/mining";
import { createLog } from "@/lib/modules/logs/repository.server";

/**
 * Recompute the `stats` effective block from raw statLevels + any future item bonuses.
 * Currently item bonuses are 0 — this is the extension point when gear is added.
 */
function computeStats(player: IPlayer): IPlayer["stats"] {
  return {
    hashRate: player.statLevels.hashRate,
    hackPower: player.statLevels.hackPower,
    security: player.statLevels.security,
    luck: player.statLevels.luck,
    firewall: player.statLevels.firewall,
    exploit: player.statLevels.exploit,
  };
}

export function tickPlayer(player: IPlayer): {
  player: IPlayer;
  mined: number;
} {
  const now = Date.now();
  const timeSinceTick = Math.max(0, now - player.lastTickAt) / 1000;
  const vaultBefore = player.vault;

  // Recompute effective stats and persist them so every other server route
  // can read player.stats.hashRate instead of recalculating.
  player.stats = computeStats(player);

  const totalHashRate = effectiveHashRate(player.stats.hashRate);
  const decay = decayMultiplier(player.lastSinkAt, now);
  const rate = miningPerSecond(totalHashRate, decay);
  const rawMined = Math.max(0, rate * timeSinceTick);
  const capacity = vaultCapacity(player.vaultStaked, totalHashRate);

  player.vault = Number(Math.min(capacity, player.vault + rawMined).toFixed(6));
  player.lastTickAt = now;
  player.milestones.totalMined = Number(
    (player.milestones.totalMined + player.vault - vaultBefore).toFixed(6),
  );
  player.version = (player.version ?? 0) + 1;

  if (player.vault > player.milestones.bestHashRate) {
    player.milestones.bestHashRate = player.vault;
  }

  return { player, mined: player.vault - vaultBefore };
}

/**
 * Narrow $set payload for persisting a `tickPlayer` result — only the fields
 * tick actually touches (vault, stats, lastTickAt, two milestone counters,
 * version).
 *
 * Callers used to pass the *entire* lean player object straight back into
 * `updatePlayer`, which blindly $set the whole document. Because every GET
 * to /api/player/me (and every claim) re-runs a tick, that full-document
 * write happens constantly — and if a concurrent stake/burn/upgrade landed
 * its own atomic $inc (e.g. vaultStaked, notoriety, hash) *after* this
 * request's initial read but *before* this write, the full-document write
 * would silently stomp it back to the stale pre-increment value. That's
 * exactly what caused "Vault Size" / "Notoriety" to reset after a claim +
 * refresh. Using a field-scoped $set here means a tick write can only ever
 * touch the fields tick itself computed, so it can never clobber a sibling
 * request's atomic update to an unrelated field.
 */
export function tickPatch(player: IPlayer): Record<string, unknown> {
  return {
    vault: player.vault,
    stats: player.stats,
    lastTickAt: player.lastTickAt,
    "milestones.totalMined": player.milestones.totalMined,
    "milestones.bestHashRate": player.milestones.bestHashRate,
    version: player.version,
  };
}

export async function logTick(wallet: string, mined: number) {
  await createLog({
    type: "vault",
    wallet,
    amount: mined,
    data: { event: "tick", mined },
  });
}
