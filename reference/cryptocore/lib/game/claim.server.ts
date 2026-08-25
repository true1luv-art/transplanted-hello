// src/lib/game/claim.server.ts
import type { IPlayer } from "@/lib/modules/players/types.server";
import { findPlayerByWallet, updatePlayer } from "@/lib/modules/players/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import { incrementStat } from "@/lib/modules/game-stats/repository.server";
import { tickPlayer, tickPatch } from "@/lib/game/mining.server";

export async function claimVault(
  wallet: string,
): Promise<{ ok: boolean; claimed?: number; error?: string }> {
  let player = await findPlayerByWallet(wallet);
  if (!player) return { ok: false, error: "Player not found" };
  if (player.claimCharges <= 0) return { ok: false, error: "No claim charges" };

  // Bring vault up to date before reading it: without this, a claim right
  // after login (or any stretch since the last GET-triggered tick) would pay
  // out the stale DB value instead of everything actually mined so far.
  ({ player } = tickPlayer(player));
  if (player.vault <= 0) return { ok: false, error: "Vault is empty" };
  // Persist the tick (stats/vault/lastTickAt/version) first so it isn't lost
  // — the claim update below only touches the claim-specific fields.
  // Scoped to only the fields tick actually changed (never a full-document
  // $set) so this can't clobber a concurrent stake/burn's atomic $inc to an
  // unrelated field like vaultStaked or notoriety.
  await updatePlayer(wallet, { $set: tickPatch(player) } as unknown as Partial<IPlayer>);

  const claimable = player.vault;
  await updatePlayer(wallet, {
    $inc: {
      hash: claimable,
      "milestones.totalClaimed": claimable,
      claimCharges: -1,
    },
    $set: {
      vault: 0,
      lastSinkAt: Date.now(),
    },
  } as unknown as Partial<IPlayer>);

  await createLog({
    type: "claim",
    wallet,
    amount: claimable,
    data: { chargesRemaining: player.claimCharges - 1 },
  });

  // Fire-and-forget: track global claimed HASH.
  void incrementStat("totalHashClaimed", claimable);

  return { ok: true, claimed: claimable };
}
