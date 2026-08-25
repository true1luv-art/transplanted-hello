import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { transactionsProcessedRepository } from "@/lib/modules/transactions-processed/repository.server";
import { notFound } from "../lib/errors";
import { json } from "../lib/respond";
import { parseIntParam } from "../lib/request";
import type { Router } from "../lib/router";

export function registerTransactionsRoutes(router: Router) {
  router.get("/transactions", async ({ query }) => {
    const user = query.get("user");
    const list = user
      ? await transactionsPendingRepository.listForUser(user)
      : await transactionsPendingRepository.listPending(parseIntParam(query.get("limit"), 50));
    return json({ transactions: list });
  });

  router.get("/transactions/recent", async ({ query }) => {
    return json({
      transactions: await transactionsProcessedRepository.listRecent(
        parseIntParam(query.get("limit"), 50),
      ),
    });
  });

  router.get("/transactions/:id", async ({ params }) => {
    const { id } = params as { id: string };
    const receipt = await transactionsProcessedRepository.findByTransactionId(id);
    const pending = await transactionsPendingRepository.findByTransactionId(id);
    if (!receipt && !pending) throw notFound("Transaction not found");
    return json({ transaction: pending ?? null, receipt: receipt ?? null });
  });
}
