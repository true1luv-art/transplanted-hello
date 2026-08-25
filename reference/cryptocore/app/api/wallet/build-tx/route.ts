/**
 * POST /api/wallet/build-tx
 *
 * Server builds the unsigned player -> treasury SPL token transfer
 * transaction using our configured (Helius-preferring) RPC connection.
 * Returns it base64-serialised; the browser deserialises it, has the
 * connected wallet sign + broadcast it, then reports the resulting
 * signature to /api/game/deposit or /api/market/buy for settlement.
 *
 * Building the transaction server-side means the browser never talks to
 * Solana RPC directly — no public-endpoint 403s, no exposed Helius key,
 * and no client-side WebSocket confirmation dance.
 *
 * Body: { amount: number }  — whole HASH tokens, matches the UI's
 * "no decimals" deposit/purchase inputs.
 */

import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { config } from "@/lib/config/config";
import {
  getMintPublicKey,
  getSolanaConnection,
  getTreasuryPublicKey,
  HASH_TOKEN_PROGRAM_ID,
} from "@/lib/chain/solana/client";

export const dynamic = "force-dynamic";

const buildTxInput = z.object({
  amount: z.number().int().positive().finite(),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const treasuryAddress = config.blockchain.treasuryAddress;
  const mintAddress = config.blockchain.solana.mint;
  if (!treasuryAddress) {
    return jsonResponse({ ok: false, error: "TREASURY_ADDRESS is not set" }, request, {
      status: 500,
    });
  }
  if (!mintAddress) {
    return jsonResponse({ ok: false, error: "CONTRACT_ADDRESS (mint) is not set" }, request, {
      status: 500,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid request body" }, request, { status: 400 });
  }

  const parsed = buildTxInput.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, error: "amount must be a positive integer" }, request, {
      status: 400,
    });
  }
  const { amount } = parsed.data;

  let payerPk: PublicKey;
  try {
    payerPk = new PublicKey(auth.wallet);
  } catch {
    return jsonResponse({ ok: false, error: "Invalid wallet address on session" }, request, {
      status: 400,
    });
  }

  const connection = getSolanaConnection();
  const mintPk = getMintPublicKey();
  const treasuryPk = getTreasuryPublicKey();

  let decimals: number;
  try {
    const mintInfo = await getMint(connection, mintPk, "confirmed", HASH_TOKEN_PROGRAM_ID);
    decimals = mintInfo.decimals;
  } catch {
    return jsonResponse({ ok: false, error: "Failed to fetch mint info" }, request, {
      status: 502,
    });
  }

  const payerAta = await getAssociatedTokenAddress(mintPk, payerPk, false, HASH_TOKEN_PROGRAM_ID);
  const treasuryAta = await getAssociatedTokenAddress(
    mintPk,
    treasuryPk,
    false,
    HASH_TOKEN_PROGRAM_ID,
  );

  // The payer must already hold HASH tokens — we never create their ATA for them.
  try {
    await getAccount(connection, payerAta, "confirmed", HASH_TOKEN_PROGRAM_ID);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
      return jsonResponse(
        { ok: false, error: "Your wallet doesn't hold any HASH tokens yet" },
        request,
        { status: 400 },
      );
    }
    return jsonResponse({ ok: false, error: "Failed to check your token account" }, request, {
      status: 502,
    });
  }

  const amountInSmallestUnit = BigInt(Math.round(amount * 10 ** decimals));

  const instructions: TransactionInstruction[] = [
    // Create the treasury's ATA on demand if needed — payer covers the rent.
    createAssociatedTokenAccountIdempotentInstruction(
      payerPk,
      treasuryAta,
      treasuryPk,
      mintPk,
      HASH_TOKEN_PROGRAM_ID,
    ),
    createTransferInstruction(
      payerAta,
      treasuryAta,
      payerPk,
      amountInSmallestUnit,
      [],
      HASH_TOKEN_PROGRAM_ID,
    ),
  ];

  let blockhash: string;
  try {
    ({ blockhash } = await connection.getLatestBlockhash("confirmed"));
  } catch {
    return jsonResponse({ ok: false, error: "Failed to fetch a recent blockhash" }, request, {
      status: 502,
    });
  }

  const tx = new Transaction({ feePayer: payerPk, recentBlockhash: blockhash }).add(
    ...instructions,
  );
  const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

  return jsonResponse({ ok: true, transaction: serialized, decimals }, request, { status: 200 });
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
