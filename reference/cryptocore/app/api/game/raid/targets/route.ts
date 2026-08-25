import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { findRaidTargets } from "@/lib/modules/players/repository.server";
import { DEFAULT_PLAYER_COSMETICS } from "@/features/types/game";
import type { Rival } from "@/features/types/game";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const defense = parseInt(searchParams.get("defense") ?? "0", 10);

  if (isNaN(defense) || defense < 1) {
    return jsonResponse({ ok: false, error: "defense must be a positive integer" }, request, {
      status: 400,
    });
  }

  try {
    const attacker = await findPlayerByWallet(auth.wallet);
    if (!attacker) {
      return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
    }

    const players = await findRaidTargets(defense, auth.wallet);

    const rivals: Rival[] = players.map((p) => ({
      id: p.wallet,
      username: p.username,
      avatarSeed: p.wallet,
      address: p.wallet,
      avatar: (p.profile?.avatar as unknown as number) ?? DEFAULT_PLAYER_COSMETICS.avatar,
      banner: (p.profile?.banner as unknown as number) ?? DEFAULT_PLAYER_COSMETICS.banner,
      background:
        (p.profile?.background as unknown as number) ?? DEFAULT_PLAYER_COSMETICS.background,
      level: p.level,
      claims: p.milestones?.totalClaimed ?? 0,
      attacks: p.milestones?.raids ?? 0,
      hashRate: p.stats?.hashRate ?? p.statLevels?.hashRate ?? 1,
      vault: p.vault,
      security: p.stats?.security ?? p.statLevels?.security ?? 0,
      firewall: p.stats?.firewall ?? p.statLevels?.firewall ?? 0,
      hackPower: p.stats?.hackPower ?? p.statLevels?.hackPower ?? 1,
      equipped: [],
      raided: false,
      lastRaidedAt: null,
    }));

    return jsonResponse({ ok: true, rivals }, request);
  } catch (err) {
    console.error("[game/raid/targets]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
