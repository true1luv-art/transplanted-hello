import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { equipAsset } from "@/lib/modules/assets/repository.server";
import { updatePlayer } from "@/lib/modules/players/repository.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ assetNumber: z.number().int().positive() });

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const { assetNumber } = body.parse(await request.json());
    const result = await equipAsset(assetNumber, auth.wallet);
    if (result.ok && result.asset) {
      // Keep the player's profile reference in sync with the equipped asset.
      await updatePlayer(auth.wallet, { [`profile.${result.asset.kind}`]: result.asset._id });
    }
    return jsonResponse(result, request, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    console.error("[api/assets/equip]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
