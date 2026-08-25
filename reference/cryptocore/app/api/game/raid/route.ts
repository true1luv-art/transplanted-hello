import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import {
  findPlayerByWallet,
  updatePlayer,
  reserveRaidCharge,
} from "@/lib/modules/players/repository.server";
import { regenCharges, simulateRaid, logRaid } from "@/lib/game/raid.server";
import { incrementStat } from "@/lib/modules/game-stats/repository.server";
import { CHARGE_REGEN_MS, MAX_RAID_CHARGES } from "@/features/constants/game";
import { z } from "zod";

export const dynamic = "force-dynamic";

const raidInput = z.object({ target: z.string(), seed: z.string() });

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { target, seed } = raidInput.parse(body);

    const attacker = await findPlayerByWallet(auth.wallet);
    const defender = await findPlayerByWallet(target);
    if (!attacker || !defender) {
      return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
    }
    if (attacker.wallet === defender.wallet) {
      return jsonResponse({ ok: false, error: "Cannot raid yourself" }, request, { status: 400 });
    }

    // Regenerate + reserve (consume) exactly one raid charge atomically in
    // the DB before simulating anything. Checking `raidCharges > 0` against
    // the in-memory player object (read moments earlier) and writing the
    // decremented value back at the end — the previous approach — let two
    // concurrent raid requests from the same wallet both read the same
    // starting charge count, both pass the check, and both spend a charge
    // the player only had one of. This is now the single place raidCharges
    // is mutated for a raid attempt, win or lose.
    const reservation = await reserveRaidCharge(
      attacker.wallet,
      Date.now(),
      CHARGE_REGEN_MS,
      MAX_RAID_CHARGES,
    );
    if (!reservation.ok) {
      return jsonResponse({ ok: false, error: "No raid charges" }, request, { status: 400 });
    }

    // claimCharges regen is independent of raidCharges/lastRaidRegenAt
    // (already persisted atomically above) — only $set the claim-charge
    // fields below, never raidCharges/lastRaidRegenAt again here.
    regenCharges(attacker);

    const result = simulateRaid(attacker, defender, seed);
    // Field-scoped $set only for what raid/regenCharges actually mutated on
    // each player — never the whole document. A blind full-document write
    // here would silently revert a concurrent stake/burn/upgrade's atomic
    // $inc to an unrelated field (vaultStaked, notoriety, hash, ...) back to
    // whatever this request happened to read at the start.
    await updatePlayer(attacker.wallet, {
      $set: {
        claimCharges: attacker.claimCharges,
        lastClaimRegenAt: attacker.lastClaimRegenAt,
      },
    });
    if (result.success) {
      await updatePlayer(attacker.wallet, {
        $set: {
          vault: attacker.vault,
          xp: attacker.xp,
          "milestones.raids": attacker.milestones.raids,
          "milestones.raidWins": attacker.milestones.raidWins,
          "milestones.totalStolen": attacker.milestones.totalStolen,
        },
      });
      await updatePlayer(defender.wallet, {
        $set: { vault: defender.vault, protectionUntil: defender.protectionUntil },
      });
    }
    await logRaid(attacker.wallet, defender.wallet, result, seed, result.serverSeed);
    // Fire-and-forget: track global raid counters.
    void incrementStat("totalRaids");
    if (result.success) void incrementStat("totalRaidWins");
    // serverSeed is a server-only audit field — never returned to the client.
    const { serverSeed: _serverSeed, ...publicResult } = result;
    return jsonResponse({ ok: result.success, ...publicResult }, request);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }

    console.error("[game/raid]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
