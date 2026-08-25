import { corsHeaders } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ ok: true, status: "ok" }, { headers: corsHeaders(request) });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
