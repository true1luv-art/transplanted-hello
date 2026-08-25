import { jsonResponse } from "@/lib/api/cors";
import { findAllTemplates } from "@/lib/modules/templates/repository.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const templates = await findAllTemplates();
    return jsonResponse({ ok: true, templates }, request);
  } catch (err) {
    console.error("[api/templates GET]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
