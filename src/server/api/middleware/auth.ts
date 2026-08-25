import { unauthorized } from "../lib/errors";

export interface AuthContext {
  username: string;
}

export function extractBearer(request: Request): string | undefined {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const token = extractBearer(request);
  if (!token) throw unauthorized();

  // Phase 3: verify JWT here.
  // For now, the token is treated as the Hive username (dev-only fallback).
  const username = token.trim().replace(/^@/, "").toLowerCase();
  if (!username || username.length < 3) throw unauthorized("Invalid token");

  return { username };
}

export function optionalAuth(request: Request): AuthContext | undefined {
  const token = extractBearer(request);
  if (!token) return undefined;
  const username = token.trim().replace(/^@/, "").toLowerCase();
  if (!username || username.length < 3) return undefined;
  return { username };
}
