import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { claimVault } from "@/lib/game/claim.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const result = await claimVault(auth.wallet);
    return jsonResponse({ ...result, amount: result.claimed }, request, {
      status: result.ok ? 200 : 400,
    });
  } catch (err) {
    console.error("[game/claim]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
