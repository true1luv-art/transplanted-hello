/**
 * GET /api/wallet/balance
 *
 * Returns the signed-in wallet's real on-chain HASH token balance. Reading
 * this server-side (through our configured Helius connection) avoids the
 * 403s public RPC endpoints increasingly return for browser-origin traffic.
 */

import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { config } from "@/lib/config/config";
import {
  getMintPublicKey,
  getSolanaConnection,
  HASH_TOKEN_PROGRAM_ID,
} from "@/lib/chain/solana/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  if (!config.blockchain.solana.mint) {
    return jsonResponse({ ok: true, balance: 0 }, request, { status: 200 });
  }

  let ownerPk: PublicKey;
  try {
    ownerPk = new PublicKey(auth.wallet);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid wallet address on session" }, request, {
      status: 400,
    });
  }

  const connection = getSolanaConnection();
  const mintPk = getMintPublicKey();

  try {
    const ata = await getAssociatedTokenAddress(mintPk, ownerPk, false, HASH_TOKEN_PROGRAM_ID);
    const balance = await connection.getTokenAccountBalance(ata, "confirmed");
    return jsonResponse({ ok: true, balance: balance.value.uiAmount ?? 0 }, request, {
      status: 200,
    });
  } catch {
    // No token account yet, or RPC hiccup — treat as zero rather than erroring
    // the marketplace balance display.
    return jsonResponse({ ok: true, balance: 0 }, request, { status: 200 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
