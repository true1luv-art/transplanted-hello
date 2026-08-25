import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { openChest } from "@/lib/game/chest.server";
import { PURCHASABLE_CHEST_KEYS } from "@/features/constants/game";
import type { ChestKey } from "@/features/types/game";
import { incrementStat } from "@/lib/modules/game-stats/repository.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const chestInput = z.object({
  chest: z.enum(PURCHASABLE_CHEST_KEYS as [ChestKey, ...ChestKey[]]),
  seed: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { chest, seed } = chestInput.parse(body);
    const result = await openChest(auth.wallet, chest, seed);
    if (result.ok) void incrementStat("totalChestsOpened");
    return jsonResponse(result, request, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }

    console.error("[game/chest]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
