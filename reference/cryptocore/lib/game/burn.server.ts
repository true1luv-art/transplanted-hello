// src/lib/game/burn.server.ts
import type { IPlayer } from "@/lib/modules/players/types.server";
import { debitHash, updatePlayer } from "@/lib/modules/players/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";

export const BURN_TO_NOTORITY_RATIO = 1; // 1 burned HASH = 1 notoriety

/**
 * Burning HASH only ever grants Notoriety (1:1). Exploit is NOT incremented
 * here directly — it's derived from cumulative Notoriety via a fixed bonus
 * table (see exploitFromNotoriety() in features/game/stats.ts), and Firewall
 * comes from staked vault HASH, not from burns at all. A previous version of
 * this function also added a flat 5% of the burn straight to
 * statLevels.exploit/firewall, but derivedBaseStats() always overwrites
 * those keys with the table-derived values, so that write was dead and
 * misleading — removed.
 */
export async function burnHash(
  wallet: string,
  amount: number,
): Promise<{ ok: boolean; notoriety?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: "Amount must be positive" };
  const { ok } = await debitHash(wallet, amount);
  if (!ok) return { ok: false, error: "Not enough HASH" };

  const notorietyGain = amount * BURN_TO_NOTORITY_RATIO;

  await updatePlayer(wallet, {
    $inc: {
      notoriety: notorietyGain,
      totalBurned: amount,
    },
    $set: { lastSinkAt: Date.now() },
  } as unknown as Partial<IPlayer>);

  await createLog({
    type: "burn",
    wallet,
    amount: -amount,
    data: {
      notorietyGain,
    },
  });

  return { ok: true, notoriety: notorietyGain };
}
