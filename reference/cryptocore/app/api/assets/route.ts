import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { findAssetsByOwner } from "@/lib/modules/assets/repository.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const assets = await findAssetsByOwner(auth.wallet);
    return jsonResponse({ ok: true, assets }, request);
  } catch (err) {
    console.error("[api/assets GET]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
