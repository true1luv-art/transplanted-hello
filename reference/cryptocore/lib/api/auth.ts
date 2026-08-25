import { verifySession } from "@/lib/auth/jwt";

export interface AuthContext {
  wallet: string;
  username?: string;
}

export async function authenticateRequest(request: Request): Promise<AuthContext | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await verifySession(token);
    return { wallet: payload.wallet, username: payload.username };
  } catch {
    return Response.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }
}
