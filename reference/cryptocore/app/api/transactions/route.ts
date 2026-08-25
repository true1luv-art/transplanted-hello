import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { findPendingByWallet } from "@/lib/modules/transactions-pending/repository.server";
import { getTransactionHistory } from "@/lib/modules/transactions-processed/repository.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) });

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { limit } = query.parse(Object.fromEntries(searchParams));

    const [pending, settled] = await Promise.all([
      findPendingByWallet(auth.wallet, limit),
      getTransactionHistory(auth.wallet, limit),
    ]);

    return jsonResponse(
      {
        ok: true,
        pending: pending.map((job) => ({
          id: String(job._id),
          type: job.type,
          status: job.status,
          signature: job.signature,
          amount: job.withdrawAmount ?? job.depositAmount ?? job.price ?? 0,
          itemNumber: job.itemNumber ?? null,
          retryCount: job.retryCount,
          error: job.lastError ?? null,
          refunded: job.refunded ?? false,
          createdAt: new Date(job.createdAt).getTime(),
        })),
        history: settled.transactions.map((tx) => ({
          id: String(tx._id),
          type: tx.type,
          txHash: tx.txHash,
          amount: tx.amount,
          status: tx.status ?? "success",
          error: tx.error ?? null,
          processedAt: tx.processedAt,
          metadata: tx.metadata ?? null,
        })),
      },
      request,
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }

    console.error("[transactions]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
