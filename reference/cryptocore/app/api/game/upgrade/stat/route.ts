import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { MAX_BULK_UPGRADE_LEVELS, upgradeStat } from "@/lib/game/upgrade.server";
import { STAT_KEYS } from "@/features/constants/game";
import type { StatKey } from "@/features/types/game";
import { z } from "zod";

export const dynamic = "force-dynamic";

const statInput = z.object({
  stat: z.enum(STAT_KEYS as [StatKey, ...StatKey[]]),
  // Buy multiple levels in one request instead of one call per level.
  levels: z.coerce.number().int().min(1).max(MAX_BULK_UPGRADE_LEVELS).default(1),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { stat, levels } = statInput.parse(body);
    const result = await upgradeStat(auth.wallet, stat, levels);
    return jsonResponse(result, request, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }

    console.error("[game/upgrade/stat]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
