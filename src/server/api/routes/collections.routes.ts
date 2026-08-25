import { prepareCollection } from "@/features/lib/collections/collection-creation.service";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { nftAssetsRepository } from "@/lib/modules/nft-assets/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import { toListingView } from "@/lib/modules/nfts/model.server";
import { transactionsProcessedRepository } from "@/lib/modules/transactions-processed/repository.server";
import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { createCollectionSchema, mintSchema } from "../schemas";
import { notFound } from "../lib/errors";
import { json, readJson } from "../lib/respond";
import { parseIntParam } from "../lib/request";
import { enqueueAndProcess } from "../lib/transaction";
import { asActor } from "../lib/actor";
import type { Router } from "../lib/router";
import type { TransactionType } from "@/lib/modules/transactions-pending/types.server";
import type { CreatePendingTransactionInput } from "@/lib/modules/transactions-pending/types.server";

function makeRequestId(body: Record<string, unknown>): string {
  return (body["requestId"] as string | undefined) ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerCollectionsRoutes(router: Router) {
  /* ---------------- reads ---------------- */

  router.get("/collections", async ({ query }) => {
    const creator = query.get("creator");
    const list = creator
      ? await nftCollectionsRepository.listByCreator(creator)
      : await nftCollectionsRepository.listAll();
    return json({ collections: list });
  });

  router.get("/collections/:id", async ({ params }) => {
    const { id } = params as { id: string };
    const collection = await nftCollectionsRepository.findById(id);
    if (!collection) throw notFound("Collection not found");
    return json({ collection });
  });

  router.get("/collections/:id/nfts", async ({ params }) => {
    const { id } = params as { id: string };
    return json({ nfts: await nftsRepository.listByCollection(id) });
  });

  router.get("/collections/:id/inventory", async ({ params, query }) => {
    const { id } = params as { id: string };
    const collection = await nftCollectionsRepository.findById(id);
    if (!collection) throw notFound("Collection not found");
    const [nfts, activity] = await Promise.all([
      nftsRepository.listByCollection(id),
      activityRepository.listByCollection(id, parseIntParam(query.get("activityLimit"), 25)),
    ]);
    const items = nfts.map((nft) => ({
      ...nft,
      listingId: nft.isListed ? nft.id : null,
      seller: nft.listingSeller ?? null,
    }));
    const listings = nfts.filter((nft) => nft.isListed).map(toListingView);
    const prices = listings.map((l) => l.price);
    return json({
      collection,
      nfts: items,
      listings,
      activity,
      market: {
        listed: listings.length,
        floorPrice: prices.length ? Math.min(...prices) : 0,
        owners: new Set(nfts.map((n) => n.owner)).size,
        minted: collection.minted,
        supply: collection.maxSupply,
        volume: collection.volume,
      },
    });
  });

  router.get("/collections/:id/assets", async ({ params }) => {
    const { id } = params as { id: string };
    const collection = await nftCollectionsRepository.findById(id);
    if (!collection) throw notFound("Collection not found");
    return json({
      collectionId: id,
      creationState: collection.creationState,
      storage: {
        collectionImageUri: collection.collectionImageUri ?? null,
        collectionMetadataUri: collection.collectionMetadataUri ?? null,
        assetRootUri: collection.assetRootUri ?? null,
        metadataRootUri: collection.metadataRootUri ?? null,
        reusableAssets: collection.reusableAssets ?? false,
      },
      assets: await nftAssetsRepository.listByCollection(id),
    });
  });

  router.get("/collections/:id/listings", async ({ params }) => {
    const { id } = params as { id: string };
    return json({
      listings: (await nftsRepository.listListedByCollection(id)).map(toListingView),
    });
  });

  router.get("/collections/:id/activity", async ({ params, query }) => {
    const { id } = params as { id: string };
    return json({
      activity: await activityRepository.listByCollection(
        id,
        parseIntParam(query.get("limit"), 50),
      ),
    });
  });

  /* ---------------- mutations ---------------- */

  router.post("/collections", async ({ request }) => {
    const body = await readJson<Record<string, unknown>>(request);
    const requestId = makeRequestId(body);
    const payload = { ...body, requestId };
    const data = createCollectionSchema.parse(payload);
    const actor = asActor();

    // Idempotency: a retried request never creates a second collection.
    const settled = await transactionsProcessedRepository.findByRequestId(requestId);
    const existing = settled
      ? null
      : await transactionsPendingRepository.findOne({ requestId });
    if (settled || existing) {
      const receipt =
        settled ??
        (existing
          ? await transactionsProcessedRepository.findByTransactionId(existing.transactionId)
          : null);
      return json({
        transactionId: (settled ?? existing)!.transactionId,
        requestId,
        type: (settled ?? existing)!.type,
        status: receipt?.status ?? existing?.status ?? "pending",
        duplicate: true,
        collectionId: (settled ?? existing)?.collectionId ?? null,
        receipt: receipt ?? null,
      });
    }

    const prepared = await prepareCollection({
      creator: actor,
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      image: data.image,
      maxSupply: data.maxSupply,
      mintPrice: data.mintPrice,
      creatorFee: data.creatorFee,
      platformFee: data.platformFee,
      traitLayers: data.traitLayers as never,
      importedNfts: data.importedNfts as never,
      metadataBaseUri: data.metadataBaseUri,
      assets: data.assets,
    });

    const result = await enqueueAndProcess(
      {
        type: "CREATE_COLLECTION" as TransactionType,
        requestId,
        collectionId: prepared.collectionId,
        amount: prepared.creationCost,
        payload: prepared.payload,
      } as Omit<CreatePendingTransactionInput<"CREATE_COLLECTION">, "userId" | "hiveAccount">,
      { userId: actor, hiveAccount: actor },
    );

    const collection = await nftCollectionsRepository.findById(prepared.collectionId);
    return json({
      ...result,
      collectionId: prepared.collectionId,
      creationCost: prepared.creationCost,
      assetCount: prepared.assetCount,
      creationState: collection?.creationState ?? "FAILED",
      collection,
    });
  });

  router.post("/collections/:id/mint", async ({ request, params }) => {
    const { id } = params as { id: string };
    const body = await readJson<Record<string, unknown>>(request);
    const requestId = makeRequestId(body);
    const payload = { ...body, requestId, collectionId: id };
    const data = mintSchema.parse(payload);
    const actor = asActor();
    return json(
      await enqueueAndProcess(
        {
          type: "MINT_NFT" as TransactionType,
          requestId,
          collectionId: id,
          amount: 0,
          payload: { collectionId: id, quantity: data.quantity },
        } as Omit<CreatePendingTransactionInput<"MINT_NFT">, "userId" | "hiveAccount">,
        { userId: actor, hiveAccount: actor },
      ),
    );
  });
}
