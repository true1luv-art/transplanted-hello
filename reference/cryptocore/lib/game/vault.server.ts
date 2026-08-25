// src/lib/game/vault.server.ts
import type { IPlayer } from "@/lib/modules/players/types.server";
import { debitHash, updatePlayer } from "@/lib/modules/players/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";

/**
 * Stakes HASH into the vault (increases capacity, Luck, and Firewall — see
 * luckFromVault/firewallFromVault in features/game/stats.ts). This is
 * distinct from burnHash: staked HASH increments `vaultStaked`, burned HASH
 * increments `notoriety`. The two must never share an endpoint.
 */
export async function stakeVault(
  wallet: string,
  amount: number,
): Promise<{ ok: boolean; vaultStaked?: number; error?: string }> {
  if (amount <= 0) return { ok: false, error: "Amount must be positive" };
  const { ok } = await debitHash(wallet, amount);
  if (!ok) return { ok: false, error: "Not enough HASH" };

  await updatePlayer(wallet, {
    $inc: { vaultStaked: amount, version: 1 },
    $set: { lastSinkAt: Date.now() },
  } as unknown as Partial<IPlayer>);

  await createLog({
    type: "vault",
    wallet,
    amount: -amount,
    data: { event: "stake", vaultStakedGain: amount },
  });

  return { ok: true, vaultStaked: amount };
}
