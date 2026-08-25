import { NextResponse } from "next/server";
import { resolveRpcUrl } from "@/lib/chain/solana/client";

// Never cache/prerender — this just relays live JSON-RPC calls.
export const dynamic = "force-dynamic";

/**
 * Read-only JSON-RPC methods the browser wallet actually needs (checking
 * mint/ATA info, balances, and blockhashes before/after a signed transfer).
 * Restricting the allowlist keeps this proxy from becoming an open relay
 * against our Helius quota.
 */
const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getLatestBlockhash",
  "getTokenAccountBalance",
  "getSignatureStatuses",
  "getMinimumBalanceForRentExemption",
  "simulateTransaction",
]);

/**
 * Proxies Solana JSON-RPC requests from the browser to the real configured
 * RPC endpoint (Helius, when HELIUS_API_KEY is set). Public RPC endpoints
 * increasingly return 403 Access forbidden for browser-origin traffic, and
 * we never want to expose the Helius API key to the client bundle.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requests = Array.isArray(body) ? body : [body];
  for (const req of requests) {
    const method = (req as { method?: string } | null)?.method;
    if (!method || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { error: `RPC method not allowed: ${method ?? "unknown"}` },
        { status: 403 },
      );
    }
  }

  const upstream = await fetch(resolveRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
