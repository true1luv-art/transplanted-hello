import { config } from "@/lib/config/config";
import { collectionCreationCost } from "@/lib/config/config";
import { getWorker } from "@/server/smart-contract";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import { usersRepository } from "@/lib/modules/users/repository.server";
import { collectDiagnostics } from "../lib/diagnostics";
import { computeStats } from "../lib/stats";
import { getEventBus } from "@/features/types/events";
import { parseIntParam } from "../lib/request";
import { json } from "../lib/respond";
import type { Router } from "../lib/router";

export function registerHealthRoutes(router: Router) {
  router.get("/health", async ({ query }) => {
    const [collections, nfts, listings, activity, users] = await Promise.all([
      nftCollectionsRepository.count(),
      nftsRepository.count(),
      nftsRepository.countListed(),
      activityRepository.count(),
      usersRepository.count(),
    ]);
    const diagnostics = await collectDiagnostics({
      probeHive: query.get("hive") === "1",
    });
    return json({
      ok: diagnostics.ok,
      driver: "mongodb",
      worker: getWorker().id,
      counts: { collections, nfts, listings, activity, users },
      infrastructure: diagnostics,
    });
  });

  router.get("/creation-cost", ({ query }) => {
    const supply = Number(query.get("maxSupply") ?? "0");
    return json({
      maxSupply: supply,
      cost: collectionCreationCost(Number.isFinite(supply) ? supply : 0),
      currency: "HIVE",
    });
  });

  router.get("/stats", async () => {
    return json(await computeStats());
  });

  router.get("/events", ({ query }) => {
    return json(getEventBus().recent(parseIntParam(query.get("limit"), 50, 200)));
  });
}
