import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { unequipAsset, findAssetByNumber } from "@/lib/modules/assets/repository.server";
import { updatePlayer } from "@/lib/modules/players/repository.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ assetNumber: z.number().int().positive() });

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const { assetNumber } = body.parse(await request.json());
    // Resolve the asset kind before unequipping so we can clear the matching
    // profile reference.
    const asset = await findAssetByNumber(assetNumber);
    const result = await unequipAsset(assetNumber, auth.wallet);
    if (result.ok && asset && asset.owner === auth.wallet) {
      await updatePlayer(auth.wallet, { [`profile.${asset.kind}`]: null });
    }
    return jsonResponse(result, request, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    console.error("[api/assets/unequip]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
