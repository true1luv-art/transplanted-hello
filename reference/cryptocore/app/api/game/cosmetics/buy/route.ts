import { z } from "zod";
import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { mintCosmetic } from "@/lib/game/cosmetic-shop.server";

export const dynamic = "force-dynamic";

const buyInput = z.object({
  templateId: z.number().int().min(0),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { templateId } = buyInput.parse(body);
    const result = await mintCosmetic(auth.wallet, templateId);
    return jsonResponse(result, request, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    console.error("[game/cosmetics/buy]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
