/**
 * GET /api/wallet/treasury-balance
 *
 * Returns the treasury's real on-chain HASH token balance. This is public
 * on-chain information (anyone can look up the treasury address balance on
 * a Solana explorer), so unlike /api/wallet/balance it does not require
 * authentication — it's shown to every player so they can see the size of
 * the vault backing their deposits.
 */

import { getAssociatedTokenAddress } from "@solana/spl-token";

import { jsonResponse } from "@/lib/api/cors";
import { config } from "@/lib/config/config";
import {
  getMintPublicKey,
  getSolanaConnection,
  getTreasuryPublicKey,
  HASH_TOKEN_PROGRAM_ID,
} from "@/lib/chain/solana/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!config.blockchain.solana.mint || !config.blockchain.treasuryAddress) {
    return jsonResponse({ ok: true, balance: 0 }, request, { status: 200 });
  }

  const connection = getSolanaConnection();
  const mintPk = getMintPublicKey();
  const treasuryPk = getTreasuryPublicKey();

  try {
    const ata = await getAssociatedTokenAddress(mintPk, treasuryPk, false, HASH_TOKEN_PROGRAM_ID);
    const balance = await connection.getTokenAccountBalance(ata, "confirmed");
    return jsonResponse({ ok: true, balance: balance.value.uiAmount ?? 0 }, request, {
      status: 200,
    });
  } catch {
    // No token account yet, or RPC hiccup — treat as zero rather than erroring.
    return jsonResponse({ ok: true, balance: 0 }, request, { status: 200 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
