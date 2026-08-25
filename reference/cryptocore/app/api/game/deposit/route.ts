/**
 * POST /api/game/deposit
 *
 * Player submits a Solana tx signature proving they sent HASH tokens to the
 * treasury. The job is queued; the settlement worker verifies on-chain and
 * credits the player's in-game balance.
 *
 * Body: { txId: string, amount: number }
 * Returns 202 with jobId when queued, 400 on validation / duplicate.
 */

import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { enqueueDeposit } from "@/lib/modules/transactions-pending/repository.server";
import { isTransactionProcessed } from "@/lib/modules/transactions-processed/repository.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const depositInput = z.object({
  txId: z.string().min(32).max(128),
  // Whole HASH only — decimals would make on-chain amounts unpredictable
  // to reconcile against the treasury transfer.
  amount: z.number().int().positive().finite(),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { txId, amount } = depositInput.parse(body);

    // Reject replays before even touching the queue.
    if (await isTransactionProcessed(txId)) {
      return jsonResponse({ ok: false, error: "Transaction already processed" }, request, {
        status: 400,
      });
    }

    const { jobId, duplicate } = await enqueueDeposit({
      walletAddress: auth.wallet,
      depositAmount: amount,
      depositTxId: txId,
    });

    if (duplicate) {
      return jsonResponse({ ok: false, error: "Transaction already queued" }, request, {
        status: 400,
      });
    }

    return jsonResponse({ ok: true, queued: true, jobId, txId, amount }, request, { status: 202 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    console.error("[game/deposit]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
