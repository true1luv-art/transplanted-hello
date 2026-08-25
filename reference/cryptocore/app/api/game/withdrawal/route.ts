/**
 * POST /api/game/withdrawal
 *
 * Player requests an on-chain payout of in-game HASH to their Solana wallet.
 * HASH is debited from the player immediately (optimistic debit); the worker
 * sends the SPL tokens on-chain and refunds on terminal failure.
 *
 * Notoriety gate:
 *   - Players with zero notoriety cannot withdraw at all.
 *   - The daily withdrawal ceiling equals the player's current notoriety.
 *   - withdrawnToday resets to 0 once Date.now() > withdrawResetAt (24-hour window).
 *
 * Body: { amount: number }
 * Returns 202 with jobId and signature when queued.
 */

import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import {
  creditHash,
  debitHash,
  findPlayerByWallet,
  reserveWithdrawalCap,
  releaseWithdrawalCap,
} from "@/lib/modules/players/repository.server";
import { enqueueWithdrawal } from "@/lib/modules/transactions-pending/repository.server";
import { isChainPaymentConfigured } from "@/lib/wallet";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Minimum withdrawal enforced server-side to prevent dust transactions.
const MIN_WITHDRAWAL = 1;

// One calendar day in milliseconds.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const withdrawInput = z.object({
  // Whole HASH only — decimals would make on-chain payouts and the daily
  // cap accounting unpredictable.
  amount: z.number().int().positive().finite().min(MIN_WITHDRAWAL),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { amount } = withdrawInput.parse(body);

    // --- Chain config gate ---
    // The HASH token mint and treasury address must both be set before any
    // payout can actually settle on-chain. Without them, debiting HASH and
    // queueing a withdrawal job would create a debt the worker can never
    // pay out. Block up front instead, mirroring the deposit-side check.
    if (!isChainPaymentConfigured()) {
      return jsonResponse(
        {
          ok: false,
          error: "Withdrawals aren't available yet — on-chain payouts aren't configured.",
        },
        request,
        { status: 503 },
      );
    }

    // --- Notoriety gate ---
    const player = await findPlayerByWallet(auth.wallet);
    if (!player) {
      return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
    }

    const notoriety = player.notoriety ?? 0;
    if (notoriety <= 0) {
      return jsonResponse(
        { ok: false, error: "You need notoriety to withdraw. Burn HASH to earn notoriety." },
        request,
        { status: 403 },
      );
    }

    const now = Date.now();
    const dailyCap = notoriety; // 1:1 — notoriety == max withdrawable per day

    // Atomically debit — fails if player has insufficient balance.
    const debited = await debitHash(auth.wallet, amount);
    if (!debited.ok) {
      return jsonResponse({ ok: false, error: "Insufficient HASH balance" }, request, {
        status: 400,
      });
    }

    // Check the daily cap and record this withdrawal against the window in
    // one atomic operation (see reserveWithdrawalCap) — this MUST happen
    // after the HASH is already debited so the guarded decrement above is
    // still the sole authority on balance, and MUST be atomic itself so two
    // concurrent withdrawals can't both read the same "remaining" figure
    // and together exceed the cap.
    //
    // This step is wrapped in its own try/catch — not just checked for
    // `{ ok: false }` — because debitHash above has ALREADY taken the HASH.
    // Any unexpected throw here (e.g. a driver/ODM error) must still refund
    // the debit; letting it propagate to the outer catch would silently
    // eat the player's balance with no queued job and no way to recover it.
    let reserved: { ok: boolean };
    try {
      reserved = await reserveWithdrawalCap(auth.wallet, amount, now, ONE_DAY_MS);
    } catch (reserveErr) {
      await creditHash(auth.wallet, amount);
      throw reserveErr;
    }
    if (!reserved.ok) {
      // Refund the debit above — the cap didn't have room for this amount.
      await creditHash(auth.wallet, amount);
      const fresh = await findPlayerByWallet(auth.wallet);
      const resetAt = fresh?.withdrawResetAt ?? 0;
      const effectiveWithdrawnToday = now > resetAt ? 0 : (fresh?.withdrawnToday ?? 0);
      const remaining = Math.max(0, dailyCap - effectiveWithdrawnToday);
      return jsonResponse(
        {
          ok: false,
          error: `Daily withdrawal limit reached. You can withdraw up to ${remaining.toFixed(2)} more HASH today.`,
          remaining,
          dailyCap,
          resetAt: now > resetAt ? now + ONE_DAY_MS : resetAt,
        },
        request,
        { status: 403 },
      );
    }

    // Queue the payout. Worker sends SPL on-chain and refunds if it fails.
    let jobId: string;
    let signature: string;
    try {
      ({ jobId, signature } = await enqueueWithdrawal({
        walletAddress: auth.wallet,
        withdrawAmount: amount,
      }));
    } catch (enqueueErr) {
      // Roll back both the cap reservation and the HASH debit so a failed
      // enqueue never leaves the player short HASH with nothing queued.
      await releaseWithdrawalCap(auth.wallet, amount);
      await creditHash(auth.wallet, amount);
      throw enqueueErr;
    }

    return jsonResponse({ ok: true, queued: true, jobId, signature, amount }, request, {
      status: 202,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    console.error("[game/withdrawal]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
