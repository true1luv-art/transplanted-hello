import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { getMarketplaceService } from "@/features/lib/marketplace/marketplace.service";
import { toListingView } from "@/lib/modules/nfts/model.server";
import { buySchema } from "../schemas";
import { notFound } from "../lib/errors";
import { json, readJson } from "../lib/respond";
import { asActor } from "../lib/actor";
import type { Router } from "../lib/router";

function makeRequestId(body: Record<string, unknown>): string {
  return (body["requestId"] as string | undefined) ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerListingsRoutes(router: Router) {
  /* ---------------- reads ---------------- */

  router.get("/listings", async ({ query }) => {
    const collectionId = query.get("collectionId");
    const seller = query.get("seller");
    const list = seller
      ? await nftsRepository.listListedBySeller(seller)
      : collectionId
        ? await nftsRepository.listListedByCollection(collectionId)
        : await nftsRepository.listListed();
    return json({ listings: list.map(toListingView) });
  });

  router.get("/listings/:id", async ({ params }) => {
    const { id } = params as { id: string };
    const listed = await nftsRepository.findById(id);
    if (!listed?.isListed) throw notFound("Listing not found");
    return json({ listing: toListingView(listed) });
  });

  /* ---------------- mutations ---------------- */

  router.post("/listings/:id/buy", async ({ request, params }) => {
    const { id } = params as { id: string };
    const body = await readJson<Record<string, unknown>>(request);
    const requestId = makeRequestId(body);
    const payload = { ...body, requestId, listingId: id };
    buySchema.parse(payload);
    const actor = asActor();
    const marketplace = getMarketplaceService();
    return json(await marketplace.buy({ requestId, hiveAccount: actor }, { listingId: id }));
  });

  router.post("/listings/:id/cancel", async ({ request, params }) => {
    const { id } = params as { id: string };
    const body = await readJson<Record<string, unknown>>(request);
    const requestId = makeRequestId(body);
    const payload = { ...body, requestId, listingId: id };
    buySchema.parse(payload);
    const actor = asActor();
    const marketplace = getMarketplaceService();
    return json(await marketplace.cancel({ requestId, hiveAccount: actor }, { listingId: id }));
  });
}
