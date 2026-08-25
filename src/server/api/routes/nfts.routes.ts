import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import { getMarketplaceService } from "@/features/lib/marketplace/marketplace.service";
import { toListingView } from "@/lib/modules/nfts/model.server";
import { listSchema, transferSchema } from "../schemas";
import { notFound } from "../lib/errors";
import { json, readJson } from "../lib/respond";
import { parseIntParam } from "../lib/request";
import { asActor } from "../lib/actor";
import type { Router } from "../lib/router";

function makeRequestId(body: Record<string, unknown>): string {
  return (body["requestId"] as string | undefined) ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerNftsRoutes(router: Router) {
  /* ---------------- reads ---------------- */

  router.get("/nfts", async ({ query }) => {
    const owner = query.get("owner");
    const list = owner ? await nftsRepository.listByOwner(owner) : await nftsRepository.listAll();
    return json({ nfts: list });
  });

  router.get("/nfts/:id", async ({ params }) => {
    const { id } = params as { id: string };
    const nft = await nftsRepository.findById(id);
    if (!nft) throw notFound("NFT not found");
    return json({ nft });
  });

  router.get("/nfts/:id/listing", async ({ params }) => {
    const { id } = params as { id: string };
    const nft = await nftsRepository.findById(id);
    return json({ listing: nft?.isListed ? toListingView(nft) : null });
  });

  router.get("/nfts/:id/activity", async ({ params, query }) => {
    const { id } = params as { id: string };
    return json({
      activity: await activityRepository.listByNft(id, parseIntParam(query.get("limit"), 50)),
    });
  });

  /* ---------------- mutations ---------------- */

  router.post("/nfts/:id/list", async ({ request, params }) => {
    const { id } = params as { id: string };
    const body = await readJson<Record<string, unknown>>(request);
    const requestId = makeRequestId(body);
    const payload = { ...body, requestId, nftId: id };
    const data = listSchema.parse(payload);
    const actor = asActor();
    const marketplace = getMarketplaceService();
    return json(
      await marketplace.list({ requestId, hiveAccount: actor }, { nftId: id, price: data.price }),
    );
  });

  router.post("/nfts/:id/transfer", async ({ request, params }) => {
    const { id } = params as { id: string };
    const body = await readJson<Record<string, unknown>>(request);
    const requestId = makeRequestId(body);
    const payload = { ...body, requestId, nftId: id };
    const data = transferSchema.parse(payload);
    const actor = asActor();
    const marketplace = getMarketplaceService();
    return json(
      await marketplace.transfer({ requestId, hiveAccount: actor }, { nftId: id, to: data.to }),
    );
  });
}
