import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { PlayerModel } from "@/lib/modules/players/model.server";
import { connectDatabase } from "@/lib/config/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const player = await findPlayerByWallet(auth.wallet);
    if (!player) {
      return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
    }

    await connectDatabase();
    const referred = await PlayerModel.find(
      { referredBy: auth.wallet },
      { username: 1, wallet: 1, registrationTime: 1 },
    ).lean();

    return jsonResponse(
      {
        ok: true,
        referralCode: player.username,
        referralCount: player.referralCount ?? 0,
        referralEarned: player.referralEarned ?? 0,
        referred: referred.map((r) => ({
          username: r.username,
          wallet: r.wallet,
          joinedAt: r.registrationTime,
        })),
      },
      request,
    );
  } catch (err) {
    console.error("[player/referrals GET]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
