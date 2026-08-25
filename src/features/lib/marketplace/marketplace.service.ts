/**
 * Marketplace service — DIRECT operations (Phase 2.5).
 *
 * List / Buy / Cancel / Transfer are user-signed actions. They are authorized
 * through the (mock) Hive Keychain, executed immediately against the
 * blockchain service, and written straight to the read models. They never
 * enter `transactions_pending`: that queue belongs to platform operations
 * (collection deployment and minting) processed by the smart-contract worker.
 *
 * Every direct operation still produces a `transactions_processed` receipt, an
 * activity row and typed application events, so the UI history is identical to
 * queued operations.
 *
 * Constraints: no React, no Zustand, no browser APIs.
 */
import { config, splitSalePayment } from "@/lib/config/config";
import { logger } from "@/lib/config/logger";
import { MARKET_ACCOUNT } from "@/lib/constants";
import { APP_EVENTS, emitAppEvent } from "@/features/types/events";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { newTransactionId } from "@/lib/modules/transactions-pending/model.server";
import { transactionsProcessedRepository } from "@/lib/modules/transactions-processed/repository.server";
import type { DirectTransactionType } from "@/lib/modules/transactions-pending/types.server";
import { usersRepository } from "@/lib/modules/users/repository.server";
import { getBlockchainService } from "@/server/smart-contract";
import type { BlockchainService } from "@/server/smart-contract/blockchain.service";
import { getKeychainService } from "@/features/mocks/mock-keychain.service";
import type { KeychainService } from "@/features/mocks/mock-keychain.service";

const round = (value: number) => Number(value.toFixed(3));

/** Terminal, user-fixable failure. Direct operations are never retried. */
export class MarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export interface DirectResult {
  transactionId: string;
  requestId: string;
  type: DirectTransactionType;
  status: "processed";
  direct: true;
  duplicate: boolean;
  hiveTransactionId: string;
  blockNumber: number;
  collectionId?: string | undefined;
  nftId?: string | undefined;
  result: Record<string, unknown>;
}

interface Actor {
  requestId: string;
  hiveAccount: string;
}

export class MarketplaceService {
  constructor(
    private readonly chain: BlockchainService = getBlockchainService(),
    private readonly keychain: KeychainService = getKeychainService(),
  ) {}

  /* ---------------------------------------------------------------- */
  /* helpers                                                           */
  /* ---------------------------------------------------------------- */

  /** Idempotency: the same requestId always resolves to the same receipt. */
  private async existing(requestId: string): Promise<DirectResult | null> {
    const receipt = await transactionsProcessedRepository.findOne({ requestId });
    if (!receipt) return null;
    return {
      transactionId: receipt.transactionId,
      requestId: receipt.requestId,
      type: receipt.type as DirectTransactionType,
      status: "processed",
      direct: true,
      duplicate: true,
      hiveTransactionId: receipt.hiveTransactionId,
      blockNumber: receipt.blockNumber,
      collectionId: receipt.collectionId,
      nftId: receipt.nftId,
      result: receipt.result,
    };
  }

  private async record(
    actor: Actor,
    type: DirectTransactionType,
    outcome: {
      transactionId: string;
      hiveTransactionId: string;
      blockNumber: number;
      collectionId?: string | undefined;
      nftId?: string | undefined;
      result: Record<string, unknown>;
    },
  ): Promise<DirectResult> {
    await transactionsProcessedRepository.record({
      transactionId: outcome.transactionId,
      requestId: actor.requestId,
      type,
      status: "processed",
      hiveTransactionId: outcome.hiveTransactionId,
      blockNumber: outcome.blockNumber,
      userId: actor.hiveAccount,
      hiveAccount: actor.hiveAccount,
      collectionId: outcome.collectionId,
      nftId: outcome.nftId,
      result: { ...outcome.result, direct: true },
    });
    logger.info("MARKETPLACE", `${type} confirmed ${outcome.transactionId}`);
    return {
      transactionId: outcome.transactionId,
      requestId: actor.requestId,
      type,
      status: "processed",
      direct: true,
      duplicate: false,
      hiveTransactionId: outcome.hiveTransactionId,
      blockNumber: outcome.blockNumber,
      collectionId: outcome.collectionId,
      nftId: outcome.nftId,
      result: outcome.result,
    };
  }

  /* ---------------------------------------------------------------- */
  /* operations                                                        */
  /* ---------------------------------------------------------------- */

  async list(actor: Actor, input: { nftId: string; price: number }): Promise<DirectResult> {
    const duplicate = await this.existing(actor.requestId);
    if (duplicate) return duplicate;

    const nft = await nftsRepository.findById(input.nftId);
    if (!nft) throw new MarketplaceError("NFT not found");
    if (nft.owner !== actor.hiveAccount)
      throw new MarketplaceError("Only the owner can list this NFT");

    if (nft.isListed) throw new MarketplaceError("NFT is already listed");

    const collection = await nftCollectionsRepository.findById(nft.collectionId);
    const price = round(input.price);
    const transactionId = newTransactionId();

    await this.keychain.requestSignature({
      account: actor.hiveAccount,
      operation: `List ${nft.name} for ${price} HIVE`,
      amount: price,
    });

    const sell = await this.chain.sellNft({
      symbol: collection?.symbol ?? nft.collectionName,
      seller: actor.hiveAccount,
      tokenId: nft.tokenId,
      price,
    });

    // A listing is cached market state on the NFT — there is no listings table.
    const listing = (await nftsRepository.markListed(nft.id, {
      price,
      seller: actor.hiveAccount,
      transactionId,
    }))!;

    await activityRepository.record({
      type: "Listed",
      actor: actor.hiveAccount,
      nftId: nft.id,
      collectionId: nft.collectionId,
      label: `@${actor.hiveAccount} listed ${nft.name}`,
      amount: price,
      transactionId,
      hiveTransactionId: sell.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_LISTED, {
      transactionId,
      hiveTransactionId: sell.hiveTransactionId,
      listingId: listing.id,
      nftId: nft.id,
      collectionId: nft.collectionId,
      seller: actor.hiveAccount,
      price,
    });

    return this.record(actor, "LIST_NFT", {
      transactionId,
      hiveTransactionId: sell.hiveTransactionId,
      blockNumber: sell.blockNumber,
      collectionId: nft.collectionId,
      nftId: nft.id,
      result: {
        listingId: listing.id,
        price,
        marketplaceFeePercent: config.fees.marketplaceFeePercent,
      },
    });
  }

  async cancel(actor: Actor, input: { listingId: string }): Promise<DirectResult> {
    const duplicate = await this.existing(actor.requestId);
    if (duplicate) return duplicate;

    const listed = await nftsRepository.findById(input.listingId);
    if (!listed || !listed.isListed || !listed.listingSeller || !listed.listingPrice)
      throw new MarketplaceError("Listing not found");
    const listing = {
      id: listed.id,
      nftId: listed.id,
      collectionId: listed.collectionId,
      seller: listed.listingSeller,
      price: listed.listingPrice,
    };
    if (listing.seller !== actor.hiveAccount)
      throw new MarketplaceError("Only the seller can cancel this listing");

    const nft = listed;
    const collection = await nftCollectionsRepository.findById(listing.collectionId);
    const transactionId = newTransactionId();

    await this.keychain.requestSignature({
      account: actor.hiveAccount,
      operation: `Cancel listing for ${nft?.name ?? "NFT"}`,
    });

    const cancel = await this.chain.cancelSell({
      symbol: collection?.symbol ?? "UNKNOWN",
      seller: listing.seller,
      tokenId: nft?.tokenId ?? 0,
      price: listing.price,
    });

    await nftsRepository.markUnlisted(listing.id);

    await activityRepository.record({
      type: "Delisted",
      actor: listing.seller,
      nftId: listing.nftId,
      collectionId: listing.collectionId,
      label: `@${listing.seller} cancelled listing for ${nft?.name ?? "NFT"}`,
      amount: listing.price,
      transactionId,
      hiveTransactionId: cancel.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.LISTING_CANCELLED, {
      transactionId,
      hiveTransactionId: cancel.hiveTransactionId,
      listingId: listing.id,
      nftId: listing.nftId,
      seller: listing.seller,
    });

    return this.record(actor, "CANCEL_LISTING", {
      transactionId,
      hiveTransactionId: cancel.hiveTransactionId,
      blockNumber: cancel.blockNumber,
      collectionId: listing.collectionId,
      nftId: listing.nftId,
      result: { listingId: listing.id },
    });
  }

  async buy(actor: Actor, input: { listingId: string }): Promise<DirectResult> {
    const duplicate = await this.existing(actor.requestId);
    if (duplicate) return duplicate;

    const listed = await nftsRepository.findById(input.listingId);
    if (!listed || !listed.isListed || !listed.listingSeller || !listed.listingPrice)
      throw new MarketplaceError("Listing not found");
    const listing = {
      id: listed.id,
      nftId: listed.id,
      collectionId: listed.collectionId,
      seller: listed.listingSeller,
      price: listed.listingPrice,
    };
    if (listing.seller === actor.hiveAccount)
      throw new MarketplaceError("You cannot buy your own listing");

    const nft = listed;

    const buyer = await usersRepository.ensure({ username: actor.hiveAccount });
    const split = splitSalePayment(listing.price);
    if (buyer.ledgerBalance < split.total) throw new MarketplaceError("Insufficient HIVE balance");

    const collection = await nftCollectionsRepository.findById(listing.collectionId);
    const transactionId = newTransactionId();

    await this.keychain.requestSignature({
      account: actor.hiveAccount,
      operation: `Buy ${nft.name}`,
      amount: split.total,
      memo: `Marketplace purchase · ${nft.name}`,
    });

    const purchase = await this.chain.buyNft({
      symbol: collection?.symbol ?? nft.collectionName,
      seller: listing.seller,
      buyer: actor.hiveAccount,
      tokenId: nft.tokenId,
      price: listing.price,
    });

    await emitAppEvent(APP_EVENTS.PAYMENT_CONFIRMED, {
      transactionId,
      hiveTransactionId: purchase.hiveTransactionId,
      from: actor.hiveAccount,
      to: MARKET_ACCOUNT,
      amount: split.total,
      currency: "HIVE",
      memo: `Marketplace purchase · ${nft.name}`,
    });

    await usersRepository.adjustBalance(actor.hiveAccount, -split.total);
    await usersRepository.ensure({ username: listing.seller });
    await usersRepository.adjustBalance(listing.seller, split.sellerProceeds);

    await nftsRepository.transferOwnership(nft.id, actor.hiveAccount, round(listing.price * 1.05));
    await nftsRepository.markUnlisted(listing.id);
    await nftCollectionsRepository.registerSale(listing.collectionId, listing.price);
    const holders = await nftsRepository.countHolders(listing.collectionId);
    await nftCollectionsRepository.patch(listing.collectionId, { holders });

    await activityRepository.record({
      type: "Sold",
      actor: actor.hiveAccount,
      target: listing.seller,
      nftId: nft.id,
      collectionId: listing.collectionId,
      label: `@${actor.hiveAccount} purchased ${nft.name}`,
      amount: listing.price,
      transactionId,
      hiveTransactionId: purchase.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_SOLD, {
      transactionId,
      hiveTransactionId: purchase.hiveTransactionId,
      listingId: listing.id,
      nftId: nft.id,
      collectionId: listing.collectionId,
      seller: listing.seller,
      buyer: actor.hiveAccount,
      price: listing.price,
      marketplaceFee: split.fee,
    });

    return this.record(actor, "BUY_NFT", {
      transactionId,
      hiveTransactionId: purchase.hiveTransactionId,
      blockNumber: purchase.blockNumber,
      collectionId: listing.collectionId,
      nftId: nft.id,
      result: {
        listingId: listing.id,
        price: split.price,
        fee: split.fee,
        total: split.total,
        sellerProceeds: split.sellerProceeds,
        seller: listing.seller,
      },
    });
  }

  async transfer(actor: Actor, input: { nftId: string; to: string }): Promise<DirectResult> {
    const duplicate = await this.existing(actor.requestId);
    if (duplicate) return duplicate;

    const nft = await nftsRepository.findById(input.nftId);
    if (!nft) throw new MarketplaceError("NFT not found");
    if (nft.owner !== actor.hiveAccount)
      throw new MarketplaceError("Only the owner can transfer this NFT");
    if (input.to === nft.owner) throw new MarketplaceError("Cannot transfer an NFT to yourself");

    const collection = await nftCollectionsRepository.findById(nft.collectionId);
    const transactionId = newTransactionId();

    await this.keychain.requestSignature({
      account: actor.hiveAccount,
      operation: `Transfer ${nft.name} to @${input.to}`,
    });

    // Ownership change invalidates any cached listing.
    if (nft.isListed) await nftsRepository.markUnlisted(nft.id);

    const transfer = await this.chain.transferNft({
      symbol: collection?.symbol ?? nft.collectionName,
      from: nft.owner,
      to: input.to,
      tokenId: nft.tokenId,
    });

    await usersRepository.ensure({ username: input.to });
    await nftsRepository.transferOwnership(nft.id, input.to);
    const holders = await nftsRepository.countHolders(nft.collectionId);
    await nftCollectionsRepository.patch(nft.collectionId, { holders });

    await activityRepository.record({
      type: "Transferred",
      actor: actor.hiveAccount,
      target: input.to,
      nftId: nft.id,
      collectionId: nft.collectionId,
      label: `@${actor.hiveAccount} transferred ${nft.name} to @${input.to}`,
      transactionId,
      hiveTransactionId: transfer.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_TRANSFERRED, {
      transactionId,
      hiveTransactionId: transfer.hiveTransactionId,
      nftId: nft.id,
      collectionId: nft.collectionId,
      from: actor.hiveAccount,
      to: input.to,
    });

    return this.record(actor, "TRANSFER_NFT", {
      transactionId,
      hiveTransactionId: transfer.hiveTransactionId,
      blockNumber: transfer.blockNumber,
      collectionId: nft.collectionId,
      nftId: nft.id,
      result: { to: input.to, cancelledListingId: nft.isListed ? nft.id : null },
    });
  }
}

let instance: MarketplaceService | null = null;

export function getMarketplaceService(): MarketplaceService {
  if (!instance) instance = new MarketplaceService();
  return instance;
}

/** Test/di hook. */
export function setMarketplaceService(service: MarketplaceService | null) {
  instance = service;
}
