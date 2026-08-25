// src/lib/game/market.server.ts
// Marketplace buys are paid with the on-chain SPL game token (never in-game
// HASH). The buyer transfers the listing price to the treasury, then this
// validates the listing and queues the job; the game-smart-contract worker
// verifies the payment on-chain, moves the asset/item, pays the seller and
// refunds the buyer if the listing vanished in the meantime.

import { findAssetByNumber, hasAssetWithTemplate } from "@/lib/modules/assets/repository.server";
import { findItemByNumber } from "@/lib/modules/items/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import { findPlayerByWallet } from "@/lib/modules/players/repository.server";
import { enqueueMarketPurchase } from "@/lib/modules/transactions-pending/repository.server";
import { isTransactionProcessed } from "@/lib/modules/transactions-processed/repository.server";

export async function buyFromMarket(
  kind: "asset" | "item",
  refId: number,
  buyer: string,
  paymentTxId: string,
) {
  if (!paymentTxId) return { ok: false, error: "Missing on-chain payment transaction" };

  const buyerDoc = await findPlayerByWallet(buyer);
  if (!buyerDoc) return { ok: false, error: "Buyer not registered" };

  if (await isTransactionProcessed(paymentTxId)) {
    return { ok: false, error: "Payment transaction already used" };
  }

  if (kind === "asset") {
    const asset = await findAssetByNumber(refId);
    if (!asset?.market?.isMarket) return { ok: false, error: "Asset listing not found" };
    if (asset.owner === buyer) return { ok: false, error: "Cannot buy your own listing" };

    // Players may only own one mint of a given cosmetic template — block a
    // resale purchase that would give the buyer a duplicate.
    if (await hasAssetWithTemplate(buyer, asset.templateId)) {
      return { ok: false, error: "You already own this cosmetic" };
    }

    const { jobId, duplicate } = await enqueueMarketPurchase({
      walletAddress: buyer,
      itemNumber: refId,
      itemType: "asset",
      price: asset.market.price,
      paymentTxId,
    });
    if (duplicate) return { ok: false, error: "Payment transaction already queued" };

    await createLog({
      type: "market_asset",
      wallet: asset.owner ?? "",
      target: buyer,
      data: {
        action: "sold",
        kind: "asset",
        refId,
        name: `Asset #${refId}`,
        price: asset.market.price,
      },
    });

    return {
      ok: true,
      queued: true,
      jobId,
      signature: paymentTxId,
      refId,
      price: asset.market.price,
    };
  }

  // kind === "item"
  const item = await findItemByNumber(refId);
  if (!item?.market?.isMarket) return { ok: false, error: "Item listing not found" };
  if (item.owner === buyer) return { ok: false, error: "Cannot buy your own listing" };

  const { jobId, duplicate } = await enqueueMarketPurchase({
    walletAddress: buyer,
    itemNumber: refId,
    itemType: item.slot ?? "item",
    price: item.market.price,
    paymentTxId,
  });
  if (duplicate) return { ok: false, error: "Payment transaction already queued" };

  await createLog({
    type: "market_item",
    wallet: item.owner ?? "",
    target: buyer,
    data: {
      action: "sold",
      kind: "item",
      refId,
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
      price: item.market.price,
    },
  });

  return { ok: true, queued: true, jobId, signature: paymentTxId, refId, price: item.market.price };
}
