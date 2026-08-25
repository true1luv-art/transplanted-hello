import { getWorker } from "@/server/smart-contract";
import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { json } from "../lib/respond";
import { parseIntParam } from "../lib/request";
import type { Router } from "../lib/router";

async function resetDatabase() {
  const { seedDatabase } = await import("@/server/scripts/seed");
  await seedDatabase({ force: true });
}

export function registerAdminRoutes(router: Router) {
  router.get("/admin/queue", async () => {
    return json({
      pending: await transactionsPendingRepository.listPending(50),
      worker: getWorker().id,
    });
  });

  router.post("/admin/tick", async ({ query }) => {
    const processed = await getWorker().drain(parseIntParam(query.get("max"), 25, 100));
    return json({ drained: processed, worker: getWorker().id });
  });

  router.post("/admin/reset", async () => {
    await resetDatabase();
    return json({ ok: true, message: "Database cleared and reseeded" });
  });

  // Legacy top-level dev helpers (keep during transition).
  router.post("/tick", async ({ query }) => {
    const processed = await getWorker().drain(parseIntParam(query.get("max"), 25, 100));
    return json({ drained: processed, worker: getWorker().id });
  });

  router.post("/reset", async () => {
    await resetDatabase();
    return json({ ok: true, message: "Database cleared and reseeded" });
  });
}
