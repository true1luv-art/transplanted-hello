/**
 * server/smart-contract/workers/transaction-worker.ts
 *
 * Application-side blockchain worker — NOT a deployed Hive smart contract.
 *
 * Lifecycle per transaction:
 *   transactions_pending
 *     -> lease/claim (atomic pending -> processing)
 *     -> verify the Hive transaction (real driver only)
 *     -> process the application operation
 *     -> write transactions_processed
 *     -> update the MongoDB index collections
 *     -> remove the pending document (terminal)
 *
 * Failures are split into TERMINAL (dead-lettered immediately) and TRANSIENT
 * (returned to the queue until SMART_CONTRACT_MAX_ATTEMPTS). Hive is the source
 * of truth: nothing here trusts client-supplied status or payment flags.
 *
 * Constraints: no React, no Zustand, no browser APIs.
 */
import { collectionCreationCost, config } from "@/lib/config/config";
import { logger } from "@/lib/config/logger";
import {
  COLLECTION_CREATION_FEE,
  MARKETPLACE_FEE_RATE,
  MARKET_ACCOUNT,
  PLATFORM_ACCOUNT,
} from "@/lib/constants";
import { APP_EVENTS, emitAppEvent } from "@/features/types/events";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import { createCollectionDocument } from "@/lib/modules/collections/model.server";
import { nftAssetsRepository } from "@/lib/modules/nft-assets/repository.server";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { createNftDocument, createNftDocumentFromAsset } from "@/lib/modules/nfts/model.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { transactionsProcessedRepository } from "@/lib/modules/transactions-processed/repository.server";
import { usersRepository } from "@/lib/modules/users/repository.server";
import type { PendingTransaction } from "@/lib/modules/transactions-pending/types.server";
import { getBlockchainService } from "../index";
import type { BlockchainService } from "../blockchain.service";
import { createWorkerLogger, type WorkerLogger } from "../lib/logger";
import {
  PermanentError,
  TerminalTransactionError,
  TransientTransactionError,
  errorMessage,
  isTerminalError,
} from "../lib/errors";
import { buildExpectation } from "../services/expectations";
import { indexSync } from "../services/index-sync.service";
import { MintPayoutService, planMintPayout, planSalePayout } from "../services/payouts.service";
import {
  HiveVerificationService,
  NoopVerificationService,
  type VerificationService,
} from "../services/verification.service";

interface ProcessOutcome {
  hiveTransactionId: string;
  blockNumber: number;
  result: Record<string, unknown>;
  collectionId?: string | undefined;
  nftId?: string | undefined;
}

const round = (value: number) => Number(value.toFixed(3));

/** Verification only makes sense when the backend talks to a real chain. */
function defaultVerifier(chain: BlockchainService): VerificationService {
  return chain.isMock ? new NoopVerificationService() : new HiveVerificationService();
}

export class SmartContractWorker {
  readonly id: string;
  private running = false;
  private draining = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly log: WorkerLogger;
  private readonly verifier: VerificationService;
  private readonly payouts: MintPayoutService;

  constructor(
    private readonly chain: BlockchainService = getBlockchainService(),
    id?: string,
    verifier?: VerificationService,
  ) {
    this.id = id ?? `worker-${Math.random().toString(36).slice(2, 8)}`;
    this.log = createWorkerLogger(this.id);
    this.verifier = verifier ?? defaultVerifier(this.chain);
    this.payouts = new MintPayoutService(this.chain);
  }

  /* ---------------------------------------------------------------- */
  /* queue loop                                                        */
  /* ---------------------------------------------------------------- */

  /** Claims and processes at most one transaction. Returns false when idle. */
  async processNext(): Promise<boolean> {
    await transactionsPendingRepository.recoverStale(60_000);

    const tx = await transactionsPendingRepository.claimNext(this.id);
    if (!tx) return false;

    this.log.info(`claimed ${tx.transactionId} (${tx.type})`, { attempts: tx.attempts });

    // Idempotency guard: a receipt already exists -> never process twice.
    const existingReceipt = await transactionsProcessedRepository.findByTransactionId(
      tx.transactionId,
    );
    if (existingReceipt) {
      this.log.warn(`duplicate processing prevented for ${tx.transactionId}`);
      await transactionsPendingRepository.finalize(tx.id);
      return true;
    }

    try {
      const verification = await this.verify(tx);
      if (verification) {
        // Retryable verification failures never reject the request permanently.
        if (verification.retryable)
          throw new TransientTransactionError(verification.reason, verification.code);
        throw new TerminalTransactionError(verification.reason, verification.code);
      }

      this.log.info(`processing ${tx.type}`, { transactionId: tx.transactionId });
      const outcome = await this.dispatch(tx);

      await transactionsProcessedRepository.record({
        transactionId: tx.transactionId,
        requestId: tx.requestId,
        type: tx.type,
        status: "processed",
        hiveTransactionId: outcome.hiveTransactionId,
        blockNumber: outcome.blockNumber,
        userId: tx.userId,
        hiveAccount: tx.hiveAccount,
        collectionId: outcome.collectionId ?? tx.collectionId,
        nftId: outcome.nftId ?? tx.nftId,
        result: outcome.result,
      });

      await transactionsPendingRepository.updateById(tx.id, {
        collectionId: outcome.collectionId ?? tx.collectionId,
        nftId: outcome.nftId ?? tx.nftId,
        hiveTransactionId: outcome.hiveTransactionId,
      });
      await transactionsPendingRepository.finalize(tx.id);
      logger.info("TX", `Transaction processed ${tx.transactionId}`);
      return true;
    } catch (error) {
      await this.retryOrDie(tx, error);
      return true;
    }
  }

  /**
   * Independent Hive verification of the claimed blockchain transaction.
   * Returns null when the transaction is verified (or verification does not
   * apply), otherwise the failure describing why it is not.
   */
  private async verify(tx: PendingTransaction) {
    if (this.verifier instanceof NoopVerificationService) return null;
    // Nothing was broadcast for this request yet — the worker itself performs
    // the chain operation, so there is no on-chain proof to verify.
    if (!tx.hiveTransactionId) return null;

    const expectation = await buildExpectation(tx);
    if (!expectation) return null;

    const result = await this.verifier.verify(expectation);
    if (result.ok) {
      this.log.info(`hive transaction verified ${tx.hiveTransactionId}`, {
        block: result.transaction.blockNumber,
      });
      return null;
    }
    this.log.warn(`hive verification failed for ${tx.transactionId}`, {
      code: result.code,
      retryable: result.retryable,
    });
    return result;
  }

  /** Transient failures return to the queue; terminal failures dead-letter. */
  private async retryOrDie(tx: PendingTransaction, error: unknown): Promise<void> {
    const message = errorMessage(error);
    const terminal = isTerminalError(error);
    const exhausted = tx.attempts >= config.smartContractMaxAttempts;

    if (!terminal && !exhausted) {
      this.log.warn(`attempt ${tx.attempts} failed for ${tx.transactionId}: ${message}`);
      await transactionsPendingRepository.scheduleRetry(tx.id, message);
      return;
    }

    await this.finalizeDead(tx, exhausted && !terminal ? `${message} (max retries)` : message);
  }

  /**
   * Terminal outcome: write a `failed` receipt, mark related state and remove
   * the pending document so nothing lingers past its terminal state.
   */
  private async finalizeDead(tx: PendingTransaction, reason: string): Promise<void> {
    await transactionsProcessedRepository.record({
      transactionId: tx.transactionId,
      requestId: tx.requestId,
      type: tx.type,
      status: "failed",
      hiveTransactionId: tx.hiveTransactionId ?? "",
      userId: tx.userId,
      hiveAccount: tx.hiveAccount,
      collectionId: tx.collectionId,
      nftId: tx.nftId,
      result: {},
      error: reason,
    });
    if (tx.type === "CREATE_COLLECTION" && tx.collectionId) {
      await nftCollectionsRepository.patch(tx.collectionId, {
        creationState: "FAILED",
        creationError: reason,
      });
    }
    await transactionsPendingRepository.finalize(tx.id);
    logger.error("TX", `Transaction failed ${tx.transactionId}: ${reason}`);
    await emitAppEvent(APP_EVENTS.TRANSACTION_FAILED, {
      transactionId: tx.transactionId,
      type: tx.type,
      hiveAccount: tx.hiveAccount,
      error: reason,
    });
  }

  /** Drains the queue until empty (used by the HTTP tick endpoint). */
  async drain(max = 10): Promise<number> {
    if (this.draining) return 0;
    this.draining = true;
    let processed = 0;
    try {
      while (processed < max) {
        const didWork = await this.processNext();
        if (!didWork) break;
        processed += 1;
      }
    } finally {
      this.draining = false;
    }
    return processed;
  }

  /** Long-lived polling loop (used by `npm run server:smart-contract`). */
  start() {
    if (this.running) return;
    this.running = true;
    this.log.info(`started (interval=${config.smartContractInterval}ms)`, {
      blockchainDriver: config.blockchainDriver,
      verifier: this.verifier.name,
    });
    const loop = async () => {
      if (!this.running) return;
      try {
        await this.drain(25);
      } catch (error) {
        this.log.error("poll cycle error", { error: errorMessage(error) });
      }
      if (this.running) this.timer = setTimeout(() => void loop(), config.smartContractInterval);
    };
    void loop();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.log.info("stopped");
  }

  /** Resolves once the in-flight drain cycle finished (graceful shutdown). */
  async waitForIdle(timeoutMs = 5_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (this.draining && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return !this.draining;
  }

  /* ---------------------------------------------------------------- */
  /* handlers                                                          */
  /* ---------------------------------------------------------------- */

  private dispatch(tx: PendingTransaction): Promise<ProcessOutcome> {
    switch (tx.type) {
      case "CREATE_COLLECTION":
        return this.handleCreateCollection(tx);
      case "MINT_NFT":
        return this.handleMint(tx);
      case "TRANSFER_NFT":
        return this.handleTransfer(tx);
      case "LIST_NFT":
        return this.handleList(tx);
      case "BUY_NFT":
        return this.handleBuy(tx);
      case "CANCEL_LISTING":
        return this.handleCancelListing(tx);
      default:
        throw new PermanentError(
          `Unsupported transaction type: ${String(tx.type)}`,
          "UNSUPPORTED_TRANSACTION_TYPE",
        );
    }
  }

  /* ---------------------------------------------------------------- */
  /* marketplace handlers                                              */
  /*                                                                   */
  /* Every one of these runs AFTER `verify()` has independently        */
  /* confirmed the Hive transaction. They re-validate application      */
  /* state against MongoDB (never against the client payload) and then */
  /* synchronize the index through IndexSyncService.             */
  /* ---------------------------------------------------------------- */

  /** The NFT this request targets, or a terminal failure. */
  private async requireNft(id: string | undefined) {
    if (!id) throw new PermanentError("Request has no NFT", "VALIDATION_FAILED");
    const nft = await nftsRepository.findById(id);
    if (!nft) throw new PermanentError(`NFT not found: ${id}`, "NOT_FOUND");
    return nft;
  }

  /**
   * The listed NFT this request targets. There is no listings collection:
   * a listing IS the cached market state on the NFT, and its id is the NFT id.
   */
  private async requireListedNft(tx: PendingTransaction) {
    const payload = tx.payload as { listingId?: string; nftId?: string };
    const id = payload.listingId ?? tx.listingId ?? payload.nftId ?? tx.nftId;
    if (!id) throw new PermanentError("Request has no listing", "VALIDATION_FAILED");
    const nft = await nftsRepository.findById(id);
    if (!nft) throw new PermanentError(`Listing not found: ${id}`, "NOT_FOUND");
    if (!nft.isListed || !nft.listingPrice || !nft.listingSeller)
      throw new PermanentError("Listing is not active", "VALIDATION_FAILED");
    return nft;
  }

  private async handleTransfer(tx: PendingTransaction): Promise<ProcessOutcome> {
    const payload = tx.payload as { nftId?: string; from?: string; to?: string };
    const nft = await this.requireNft(payload.nftId ?? tx.nftId);
    const recipient = (payload.to ?? "").trim().toLowerCase();
    if (!recipient) throw new PermanentError("Transfer has no recipient", "VALIDATION_FAILED");
    if (recipient === nft.owner) throw new PermanentError("Cannot transfer to the current owner");

    // Authoritative sender: the indexed owner. A client claiming
    // "alice -> bob" while the NFT belongs to charlie is a terminal failure.
    const sender = nft.owner;
    if (payload.from && payload.from.trim().toLowerCase() !== sender)
      throw new PermanentError("Declared sender does not own this NFT", "VALIDATION_FAILED");
    if (tx.hiveAccount !== sender)
      throw new PermanentError("Requester does not own this NFT", "VALIDATION_FAILED");

    const collection = await nftCollectionsRepository.findById(nft.collectionId);
    if (!collection) throw new PermanentError("Collection not found", "NOT_FOUND");

    const result = await this.chain.transferNft({
      symbol: collection.symbol,
      from: sender,
      to: recipient,
      tokenId: nft.tokenId,
    });

    // A change of owner invalidates any listing the previous owner left open.
    const cancelled = (await indexSync.clearListing(nft.id)).changed ? 1 : 0;
    await indexSync.applyOwnership(nft.id, recipient);
    await indexSync.syncCollectionStats(collection.id);

    await indexSync.recordActivity({
      type: "Transferred",
      actor: sender,
      target: recipient,
      nftId: nft.id,
      collectionId: collection.id,
      label: `@${sender} transferred ${nft.name} to @${recipient}`,
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_TRANSFERRED, {
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
      nftId: nft.id,
      collectionId: collection.id,
      from: sender,
      to: recipient,
    });

    return {
      hiveTransactionId: result.hiveTransactionId,
      blockNumber: result.blockNumber,
      collectionId: collection.id,
      nftId: nft.id,
      result: { from: sender, to: recipient, cancelledListings: cancelled },
    };
  }

  private async handleList(tx: PendingTransaction): Promise<ProcessOutcome> {
    const payload = tx.payload as { nftId?: string; price?: number };
    const nft = await this.requireNft(payload.nftId ?? tx.nftId);
    const price = round(Number(payload.price ?? 0));
    if (!Number.isFinite(price) || price <= 0)
      throw new PermanentError("Listing price must be greater than zero", "VALIDATION_FAILED");
    if (nft.owner !== tx.hiveAccount)
      throw new PermanentError("Seller does not own this NFT", "VALIDATION_FAILED");

    if (nft.isListed && nft.listingTransactionId !== tx.transactionId)
      throw new PermanentError("NFT is already listed", "VALIDATION_FAILED");

    const collection = await nftCollectionsRepository.findById(nft.collectionId);
    if (!collection) throw new PermanentError("Collection not found", "NOT_FOUND");

    const result = await this.chain.sellNft({
      symbol: collection.symbol,
      seller: nft.owner,
      tokenId: nft.tokenId,
      price,
    });

    await indexSync.cacheListing({
      transactionId: tx.transactionId,
      nftId: nft.id,
      seller: nft.owner,
      price,
    });
    await indexSync.syncCollectionStats(collection.id);

    await indexSync.recordActivity({
      type: "Listed",
      actor: nft.owner,
      nftId: nft.id,
      collectionId: collection.id,
      label: `@${nft.owner} listed ${nft.name} for ${price} HIVE`,
      amount: price,
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_LISTED, {
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
      listingId: nft.id,
      nftId: nft.id,
      collectionId: collection.id,
      seller: nft.owner,
      price,
    });

    return {
      hiveTransactionId: result.hiveTransactionId,
      blockNumber: result.blockNumber,
      collectionId: collection.id,
      nftId: nft.id,
      result: { listingId: nft.id, price },
    };
  }

  private async handleBuy(tx: PendingTransaction): Promise<ProcessOutcome> {
    const nft = await this.requireListedNft(tx);
    const listing = {
      id: nft.id,
      nftId: nft.id,
      collectionId: nft.collectionId,
      seller: nft.listingSeller!,
      price: nft.listingPrice!,
    };
    if (nft.owner !== listing.seller)
      throw new PermanentError("Listing seller no longer owns this NFT", "VALIDATION_FAILED");

    const buyer = tx.hiveAccount;
    if (buyer === listing.seller) throw new PermanentError("Seller cannot buy their own listing");

    const collection = await nftCollectionsRepository.findById(listing.collectionId);
    if (!collection) throw new PermanentError("Collection not found", "NOT_FOUND");

    // Authoritative pricing: the indexed listing, never the client payload.
    const fee = round(listing.price * MARKETPLACE_FEE_RATE);
    const total = round(listing.price + fee);

    const buyerAccount = await usersRepository.ensure({ username: buyer });
    if (buyerAccount.ledgerBalance < total)
      throw new PermanentError("Insufficient HIVE balance", "VALIDATION_FAILED");

    const result = await this.chain.buyNft({
      symbol: collection.symbol,
      seller: listing.seller,
      buyer,
      tokenId: nft.tokenId,
      price: listing.price,
    });

    // Payment distribution is leg-by-leg persisted on the pending document,
    // so a restart between the seller leg and the fee leg never pays twice.
    const plan = planSalePayout(total, listing.seller);
    const payoutRecords = await this.payouts.distributeSale(tx, plan);

    await indexSync.clearListing(nft.id);
    await indexSync.applyOwnership(nft.id, buyer, listing.price);
    await indexSync.syncCollectionStats(collection.id, { addVolume: listing.price });

    await usersRepository.adjustBalance(buyer, -total);
    await usersRepository.ensure({ username: listing.seller });
    await usersRepository.adjustBalance(listing.seller, plan.seller.amount);

    await indexSync.recordActivity({
      type: "Sold",
      actor: buyer,
      target: listing.seller,
      nftId: nft.id,
      collectionId: collection.id,
      label: `@${buyer} bought ${nft.name} for ${listing.price} HIVE`,
      amount: listing.price,
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_SOLD, {
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
      listingId: listing.id,
      nftId: nft.id,
      collectionId: collection.id,
      seller: listing.seller,
      buyer,
      price: listing.price,
      marketplaceFee: fee,
    });

    return {
      hiveTransactionId: result.hiveTransactionId,
      blockNumber: result.blockNumber,
      collectionId: collection.id,
      nftId: nft.id,
      result: {
        listingId: listing.id,
        price: listing.price,
        marketplaceFee: fee,
        total,
        sellerProceeds: plan.seller.amount,
        payouts: payoutRecords,
      },
    };
  }

  private async handleCancelListing(tx: PendingTransaction): Promise<ProcessOutcome> {
    const nft = await this.requireListedNft(tx);
    const listing = {
      id: nft.id,
      collectionId: nft.collectionId,
      seller: nft.listingSeller!,
      price: nft.listingPrice!,
    };
    if (listing.seller !== tx.hiveAccount)
      throw new PermanentError("Only the seller can cancel this listing", "VALIDATION_FAILED");

    const collection = await nftCollectionsRepository.findById(listing.collectionId);
    if (!collection) throw new PermanentError("Collection not found", "NOT_FOUND");

    const result = await this.chain.cancelSell({
      symbol: collection.symbol,
      seller: listing.seller,
      tokenId: nft.tokenId,
      price: listing.price,
    });

    // Cancelling never changes ownership — only the listing index.
    await indexSync.clearListing(nft.id);
    await indexSync.syncCollectionStats(collection.id);

    await indexSync.recordActivity({
      type: "Delisted",
      actor: listing.seller,
      nftId: nft.id,
      collectionId: collection.id,
      label: `@${listing.seller} delisted ${nft.name}`,
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.LISTING_CANCELLED, {
      transactionId: tx.transactionId,
      hiveTransactionId: result.hiveTransactionId,
      listingId: listing.id,
      nftId: nft.id,
      seller: listing.seller,
    });

    return {
      hiveTransactionId: result.hiveTransactionId,
      blockNumber: result.blockNumber,
      collectionId: collection.id,
      nftId: nft.id,
      result: { listingId: listing.id, status: "cancelled" },
    };
  }

  private async handleCreateCollection(tx: PendingTransaction): Promise<ProcessOutcome> {
    const payload = tx.payload as {
      collectionId?: string;
      name: string;
      symbol: string;
      description: string;
      image?: string;
      maxSupply: number;
      mintPrice: number;
      creatorFee: number;
      platformFee: number;
      metadataBaseUri?: string;
      collectionImageUri?: string;
      collectionMetadataUri?: string;
      assetRootUri?: string;
      metadataRootUri?: string;
      assetCount?: number;
      reusableAssets?: boolean;
    };

    // Rule 16: never deploy a collection whose assets are not pinned.
    if (payload.collectionId) {
      for (const [label, uri] of [
        ["collection image", payload.collectionImageUri],
        ["collection metadata", payload.collectionMetadataUri],
        ["asset root", payload.assetRootUri],
        ["metadata root", payload.metadataRootUri],
      ] as const) {
        if (!uri) throw new PermanentError(`Cannot deploy: ${label} is not stored yet`);
      }
    }

    const fee = collectionCreationCost(payload.maxSupply);
    const creator = await usersRepository.ensure({ username: tx.hiveAccount });
    if (creator.ledgerBalance < fee) {
      if (payload.collectionId) {
        await nftCollectionsRepository.patch(payload.collectionId, {
          creationState: "FAILED",
          creationError: "Insufficient HIVE balance for the collection deployment fee",
        });
      }
      throw new PermanentError("Insufficient HIVE balance for the collection deployment fee");
    }

    if (payload.collectionId) {
      await nftCollectionsRepository.patch(payload.collectionId, { creationState: "PROCESSING" });
    }

    const payment = await this.chain.transfer({
      from: tx.hiveAccount,
      to: PLATFORM_ACCOUNT,
      amount: fee,
      currency: "HIVE",
      memo: `Collection deployment · ${payload.name}`,
    });
    await emitAppEvent(APP_EVENTS.PAYMENT_CONFIRMED, {
      transactionId: tx.transactionId,
      hiveTransactionId: payment.hiveTransactionId,
      from: tx.hiveAccount,
      to: PLATFORM_ACCOUNT,
      amount: fee,
      currency: "HIVE",
      memo: `Collection deployment · ${payload.name}`,
    });

    const deploy = await this.chain.deployCollection({
      creator: tx.hiveAccount,
      symbol: payload.symbol.toUpperCase(),
      name: payload.name,
      maxSupply: payload.maxSupply,
    });

    // The row already exists when the collection was prepared with assets
    // (Phase 2.5B). Otherwise create it here for the legacy/no-asset path.
    const existing = payload.collectionId
      ? await nftCollectionsRepository.findById(payload.collectionId)
      : null;
    const doc =
      (existing
        ? await nftCollectionsRepository.patch(existing.id, {
            status: "active",
            creationState: "ACTIVE",
          })
        : null) ??
      existing ??
      (await nftCollectionsRepository.insert(
        createCollectionDocument({
          name: payload.name,
          symbol: payload.symbol,
          description: payload.description,
          image: payload.image,
          creator: tx.hiveAccount,
          maxSupply: payload.maxSupply,
          mintPrice: payload.mintPrice,
          creatorFee: payload.creatorFee,
          platformFee: payload.platformFee,
          metadataBaseUri: payload.metadataBaseUri,
          creationState: "ACTIVE",
          collectionImageUri: payload.collectionImageUri,
          collectionMetadataUri: payload.collectionMetadataUri,
          assetRootUri: payload.assetRootUri,
          metadataRootUri: payload.metadataRootUri,
          assetCount: payload.assetCount ?? 0,
          reusableAssets: payload.reusableAssets ?? false,
        }),
      ));

    const assetCount = await nftAssetsRepository.countByCollection(doc.id);
    if (assetCount !== (doc.assetCount ?? 0)) {
      await nftCollectionsRepository.patch(doc.id, { assetCount });
    }

    await usersRepository.adjustBalance(tx.hiveAccount, -fee);
    await activityRepository.record({
      type: "Collection Created",
      actor: tx.hiveAccount,
      collectionId: doc.id,
      label: `@${tx.hiveAccount} created ${doc.name}`,
      amount: fee,
      transactionId: tx.transactionId,
      hiveTransactionId: deploy.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.COLLECTION_CREATED, {
      transactionId: tx.transactionId,
      hiveTransactionId: deploy.hiveTransactionId,
      collectionId: doc.id,
      creator: doc.creator,
      symbol: doc.symbol,
      maxSupply: doc.maxSupply,
    });

    return {
      hiveTransactionId: deploy.hiveTransactionId,
      blockNumber: deploy.blockNumber,
      collectionId: doc.id,
      result: {
        collectionId: doc.id,
        symbol: doc.symbol,
        fee,
        assetCount,
        collectionImageUri: doc.collectionImageUri,
        collectionMetadataUri: doc.collectionMetadataUri,
        assetRootUri: doc.assetRootUri,
        metadataRootUri: doc.metadataRootUri,
      },
    };
  }

  private async handleMint(tx: PendingTransaction): Promise<ProcessOutcome> {
    const { collectionId } = tx.payload as { collectionId: string };
    const collection = await nftCollectionsRepository.findById(collectionId);
    if (!collection) throw new PermanentError("Collection not found");
    if (collection.minted >= collection.maxSupply)
      throw new PermanentError("Collection is sold out");

    const buyer = await usersRepository.ensure({ username: tx.hiveAccount });
    const platformFee = round(collection.mintPrice * (collection.platformFee / 100));
    const total = round(collection.mintPrice + platformFee);
    if (buyer.ledgerBalance < total) throw new PermanentError("Insufficient HIVE balance");

    // Reserve the supply slot BEFORE payment or any chain call so concurrent
    // mints can never overrun maxSupply. Released again if anything fails.
    const reservation = await nftCollectionsRepository.reserveMint(collection.id);
    if (!reservation) throw new PermanentError("Collection is sold out");
    const mintNumber = reservation.mintNumber;

    // The mint CLAIMS one UNMINTED row from `nft_assets`. Nothing is
    // generated when the collection has a staged pool: the token already
    // exists as an asset and is only promoted to the `nfts` index.
    const asset = await nftAssetsRepository.reserveForMint(
      collection.id,
      mintNumber,
      tx.transactionId,
    );
    if (!asset && (await nftAssetsRepository.countByCollection(collection.id)) > 0) {
      await nftCollectionsRepository.releaseMint(collection.id);
      throw new PermanentError("No unminted NFTs remain in this collection");
    }

    const nft = asset
      ? createNftDocumentFromAsset({
          collection,
          asset,
          mintNumber,
          owner: tx.hiveAccount,
          mintTransactionId: tx.transactionId,
        })
      : createNftDocument({
          collection,
          mintNumber,
          owner: tx.hiveAccount,
          mintTransactionId: tx.transactionId,
          seedKey: `${collection.id}-${mintNumber}-${tx.transactionId}`,
        });

    let issue;
    try {
      const payment = await this.chain.transfer({
        from: tx.hiveAccount,
        to: PLATFORM_ACCOUNT,
        amount: total,
        currency: "HIVE",
        memo: `Mint · ${collection.name}`,
      });
      await emitAppEvent(APP_EVENTS.PAYMENT_CONFIRMED, {
        transactionId: tx.transactionId,
        hiveTransactionId: payment.hiveTransactionId,
        from: tx.hiveAccount,
        to: PLATFORM_ACCOUNT,
        amount: total,
        currency: "HIVE",
        memo: `Mint · ${collection.name}`,
      });

      issue = await this.chain.issueNft({
        symbol: collection.symbol,
        to: tx.hiveAccount,
        tokenId: nft.tokenId,
        metadataUri: nft.metadataUri,
      });

      nft.hiveTransactionId = issue.hiveTransactionId;
      nft.blockNumber = issue.blockNumber;
      await nftsRepository.insert(nft);
      // The asset is consumed only after the mint is on chain and indexed.
      if (asset) await nftAssetsRepository.consume(asset.id);
    } catch (error) {
      await nftCollectionsRepository.releaseMint(collection.id);
      // Hand the reserved asset back to the unminted pool.
      if (asset) await nftAssetsRepository.release(asset.id);
      throw error;
    }

    await nftCollectionsRepository.addVolume(collection.id, total);
    const holders = await nftsRepository.countHolders(collection.id);
    await nftCollectionsRepository.patch(collection.id, { holders });

    // Distribution of the VERIFIED payment. The plan is integer-safe and can
    // never distribute more than `mintPrice`; each leg is persisted before the
    // next runs, so a retry resumes instead of paying twice.
    const plan = planMintPayout(collection.mintPrice, collection.creator);
    const payoutRecords = await this.payouts.distribute(tx, plan);
    const creatorShare = plan.creator.amount;

    await usersRepository.adjustBalance(tx.hiveAccount, -total);
    await usersRepository.ensure({ username: collection.creator });
    await usersRepository.adjustBalance(collection.creator, creatorShare);

    await activityRepository.record({
      type: "Minted",
      actor: tx.hiveAccount,
      nftId: nft.id,
      collectionId: collection.id,
      label: `@${tx.hiveAccount} minted ${nft.name}`,
      amount: collection.mintPrice,
      transactionId: tx.transactionId,
      hiveTransactionId: issue.hiveTransactionId,
    });

    await emitAppEvent(APP_EVENTS.NFT_MINTED, {
      transactionId: tx.transactionId,
      hiveTransactionId: issue.hiveTransactionId,
      nftId: nft.id,
      collectionId: collection.id,
      owner: nft.owner,
      tokenId: nft.tokenId,
    });

    return {
      hiveTransactionId: issue.hiveTransactionId,
      blockNumber: issue.blockNumber,
      collectionId: collection.id,
      nftId: nft.id,
      result: {
        nftId: nft.id,
        tokenId: nft.tokenId,
        name: nft.name,
        mintNumber: nft.mintNumber,
        mintPrice: collection.mintPrice,
        platformFee,
        total,
        creatorShare,
        platformShare: plan.platform.amount,
        payouts: payoutRecords,
      },
    };
  }
}

export { PermanentError, TerminalTransactionError, TransientTransactionError } from "../lib/errors";

interface WorkerGlobal {
  __hivemint_worker?: SmartContractWorker | undefined;
}
const workerGlobal = globalThis as unknown as WorkerGlobal;

export function getWorker(): SmartContractWorker {
  if (!workerGlobal.__hivemint_worker) workerGlobal.__hivemint_worker = new SmartContractWorker();
  return workerGlobal.__hivemint_worker;
}
