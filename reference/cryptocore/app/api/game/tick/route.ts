import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { tickPlayer, tickPatch } from "@/lib/game/mining.server";
import { findPlayerByWallet, updatePlayer } from "@/lib/modules/players/repository.server";
import { incrementStat } from "@/lib/modules/game-stats/repository.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const player = await findPlayerByWallet(auth.wallet);
    if (!player) {
      return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
    }
    const { player: updated, mined } = tickPlayer(player);
    // Scoped $set — see tickPatch: avoids clobbering a concurrent atomic
    // update (stake/burn/upgrade) to a field tick doesn't own.
    await updatePlayer(auth.wallet, { $set: tickPatch(updated) });
    // Fire-and-forget: increment global totalHashMined by the amount mined this tick.
    if (mined > 0) void incrementStat("totalHashMined", mined);
    return jsonResponse({ ok: true, mined, vault: updated.vault }, request);
  } catch (err) {
    console.error("[game/tick]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
