import { verifyLoginSignature } from "@/lib/auth/login.server";
import { jsonResponse } from "@/lib/api/cors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const verifyInput = z.object({ wallet: z.string().min(32), signature: z.string() });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, signature } = verifyInput.parse(body);
    const result = await verifyLoginSignature(wallet, signature);
    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, request, { status: 401 });
    }
    return jsonResponse({ ok: true, token: result.token, wallet: result.payload?.wallet }, request);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }

    console.error("[auth/verify]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
