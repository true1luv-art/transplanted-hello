/**
 * server/game-smart-contract/workers/transaction-worker.ts
 *
 * Drains the transactions-pending queue and settles each job type.
 *
 * Job flow:
 *   deposit:         verifyDepositFromPlayer -> claimProcessedTransaction -> creditHash -> completeJob
 *   withdrawal:      sendOnChain -> insertProcessedTransaction -> completeJob (refund on terminal failure)
 *   market_purchase: verify SPL payment -> re-check listing -> transfer item -> pay seller on-chain
 *                    (refund buyer on-chain if the listing is gone)
 *
 * Retry policy:
 *   Terminal codes (NON_RETRYABLE): failJob(id, msg, 1) — dead-lettered immediately.
 *   Transient (RPC / network):      failJob(id, msg, maxRetries).
 *
 * Run exactly ONE instance to preserve sequential, oldest-first settlement.
 * SERVER-ONLY.
 */

import {
  listPendingOldestFirst,
  completeJob,
  failJob,
  countJobsByStatus,
} from "@/lib/modules/transactions-pending/repository.server";
import type { IInboundTransaction } from "@/lib/modules/transactions-pending/types.server";
import {
  insertProcessedTransaction,
  claimProcessedTransaction,
  recordFailedTransaction,
} from "@/lib/modules/transactions-processed/repository.server";
import type { ProcessedTxMetadata } from "@/lib/modules/transactions-processed/types.server";
import { creditHash } from "@/lib/modules/players/repository.server";
import { findItemByNumber, transferOwnership } from "@/lib/modules/items/repository.server";
import { findAssetByNumber, transferAsset } from "@/lib/modules/assets/repository.server";
import { createLog, createErrorLog } from "@/lib/modules/logs/repository.server";
import { verifyDepositFromPlayer } from "@/lib/chain/solana/verify-deposit";
import { MARKET_FEE_BPS } from "@/features/constants/game";
import { incrementStat } from "@/lib/modules/game-stats/repository.server";
import { config } from "@/lib/config/config";
import { logger } from "../lib/logger";
import type { SendResult } from "../lib/transfers";

export type SendOnChainFn = (
  playerWallet: string,
  amount: number,
  ref: string,
) => Promise<SendResult>;

/** Terminal business-logic errors — retrying will never help. */
const NON_RETRYABLE = new Set([
  "INSUFFICIENT_HASH",
  "VERIFICATION_FAILED",
  "NOT_FOUND",
  "INVALID_AMOUNT",
  "INVALID_WALLET",
  "LISTING_GONE",
]);

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class TransactionWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private stopped = false;

  constructor(
    private readonly sendOnChain: SendOnChainFn,
    private readonly pollMs = config.withdrawal.workerPollMs,
    private readonly maxRetries = config.withdrawal.maxRetries,
  ) {}

  start(): void {
    logger.info(`starting — polling every ${this.pollMs}ms, maxRetries=${this.maxRetries}`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.pollMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info("stopped");
  }

  /** One drain cycle. Never overlaps with itself. */
  private async tick(): Promise<void> {
    if (this.draining || this.stopped) return;
    this.draining = true;
    try {
      const jobs = await listPendingOldestFirst();
      if (jobs.length === 0) return;

      logger.info(`draining ${jobs.length} job(s)`);
      for (const job of jobs) {
        if (this.stopped) break;
        await this.processJob(job);
      }
    } catch (err) {
      logger.error("drain cycle error", { error: message(err) });
      await createErrorLog({ type: "error", error: message(err), data: { source: "worker" } });
    } finally {
      this.draining = false;
    }
  }

  private async processJob(job: IInboundTransaction): Promise<void> {
    switch (job.type) {
      case "deposit":
        return this.processDeposit(job);
      case "withdrawal":
        return this.processWithdrawal(job);
      case "market_purchase":
        return this.processMarketPurchase(job);
      default:
        logger.warn("unknown job type", { type: (job as { type: string }).type });
        await failJob(String(job._id), "unknown job type", 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Deposit
  // ---------------------------------------------------------------------------

  /** Verify on-chain -> claim ledger row -> credit HASH -> complete. */
  private async processDeposit(job: IInboundTransaction): Promise<void> {
    const id = String(job._id);
    const amount = job.depositAmount ?? 0;
    const txId = job.depositTxId ?? job.signature;
    try {
      const verification = await verifyDepositFromPlayer(txId, job.walletAddress, amount);
      if (!verification.ok) {
        if (verification.code === "NOT_CONFIRMED") {
          const dead = await failJob(id, verification.error ?? "not confirmed", this.maxRetries);
          if (dead) {
            await this.finalizeDead(
              job,
              "deposit",
              verification.error ?? "not confirmed (max retries)",
            );
            return;
          }
          logger.warn("deposit retry scheduled", { wallet: job.walletAddress, txId });
          return;
        }
        await this.finalizeDead(
          job,
          "deposit",
          `VERIFICATION_FAILED: ${verification.error ?? "invalid"}`,
        );
        return;
      }

      const { claimed } = await claimProcessedTransaction({
        txHash: txId,
        wallet: job.walletAddress,
        type: "deposit",
        amount,
        metadata: { type: "deposit", creditedAmount: amount },
      });

      if (claimed) {
        await creditHash(job.walletAddress, amount);
        await createLog({
          type: "deposit",
          wallet: job.walletAddress,
          amount,
          txHash: txId,
          data: { jobId: id },
        });
        void incrementStat("totalHashDeposited", amount);
        logger.info("settled deposit", { wallet: job.walletAddress, amount, txId });
      } else {
        logger.info("deposit already processed (idempotent)", { wallet: job.walletAddress, txId });
      }

      await completeJob(id);
    } catch (err) {
      await this.retryOrDie(job, "deposit", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Withdrawal
  // ---------------------------------------------------------------------------

  /**
   * HASH was already debited at enqueue time (optimistic debit), so a terminal
   * failure refunds the player before dead-lettering.
   */
  private async processWithdrawal(job: IInboundTransaction): Promise<void> {
    const id = String(job._id);
    const amount = job.withdrawAmount ?? 0;
    try {
      if (!Number.isFinite(amount) || amount <= 0) {
        throw Object.assign(new Error("Invalid withdraw amount"), { code: "INVALID_AMOUNT" });
      }

      const { signature } = await this.sendOnChain(job.walletAddress, amount, job.signature);

      await insertProcessedTransaction({
        txHash: job.signature,
        wallet: job.walletAddress,
        type: "withdrawal",
        amount: -amount,
        metadata: { type: "withdrawal", payoutTxHash: signature },
      });

      await createLog({
        type: "withdrawal",
        wallet: job.walletAddress,
        amount: -amount,
        txHash: signature,
        data: { jobId: id, payoutTxHash: signature },
      });

      void incrementStat("totalHashWithdrawn", amount);

      await completeJob(id);
      logger.info("settled withdrawal", { wallet: job.walletAddress, amount, signature });
    } catch (err) {
      const code = errorCode(err);
      if (code && NON_RETRYABLE.has(code)) {
        await this.refundWithdrawal(job, amount, `${code}: ${message(err)}`);
        await this.finalizeDead(job, "withdrawal", `${code}: ${message(err)}`);
        return;
      }
      const dead = await failJob(id, message(err), this.maxRetries);
      if (dead) {
        await this.refundWithdrawal(job, amount, message(err));
        await this.finalizeDead(job, "withdrawal", message(err));
        return;
      }
      await createErrorLog({
        type: "withdrawal",
        wallet: job.walletAddress,
        error: message(err),
        data: { dead: false, jobId: id },
      });
      logger.warn("withdrawal retry scheduled", { wallet: job.walletAddress, amount });
    }
  }

  /** Returns the pre-debited HASH so a failed payout never drains the player. */
  private async refundWithdrawal(
    job: IInboundTransaction,
    amount: number,
    reason: string,
  ): Promise<void> {
    if (amount <= 0) return;
    await creditHash(job.walletAddress, amount);
    await createLog({
      type: "withdrawal",
      wallet: job.walletAddress,
      amount,
      data: { jobId: String(job._id), refunded: true, reason },
    });
    logger.warn("refunded failed withdrawal", { wallet: job.walletAddress, amount });
  }

  // ---------------------------------------------------------------------------
  // Market purchase
  // ---------------------------------------------------------------------------

  /**
   * Market purchase, paid on-chain in SPL game tokens (never in-game HASH).
   *
   * 1. Verify the buyer's SPL payment to the treasury.
   * 2. Re-check the listing — if it sold or was delisted between payment and
   *    settlement, refund the buyer on-chain.
   * 3. Transfer ownership, pay the seller on-chain (price minus fee), mark sold.
   */
  private async processMarketPurchase(job: IInboundTransaction): Promise<void> {
    const id = String(job._id);
    const itemNumber = job.itemNumber ?? 0;
    const buyer = job.walletAddress;
    const paymentTxId = job.paymentTxId ?? job.signature;
    const paid = job.price ?? 0;
    try {
      // 1 — verify on-chain payment.
      const verification = await verifyDepositFromPlayer(paymentTxId, buyer, paid);
      if (!verification.ok) {
        if (verification.code === "NOT_CONFIRMED") {
          const dead = await failJob(
            id,
            verification.error ?? "payment not confirmed",
            this.maxRetries,
          );
          if (dead) {
            await this.finalizeDead(
              job,
              "market",
              verification.error ?? "payment not confirmed (max retries)",
            );
            return;
          }
          logger.warn("market payment retry scheduled", { buyer, itemNumber, paymentTxId });
          return;
        }
        await this.finalizeDead(
          job,
          "market",
          `VERIFICATION_FAILED: ${verification.error ?? "invalid payment"}`,
        );
        return;
      }

      const price = paid;
      const fee = Math.floor(price * (MARKET_FEE_BPS / 10000));
      const sellerProceeds = price - fee;

      // 2 — re-check the listing using the embedded market field.
      //     job.itemType === "asset" routes to the assets collection; everything
      //     else is an item. Both collections carry the same embedded MarketSchema.
      const isAsset = job.itemType === "asset";

      let seller = "";
      let itemName = "";
      let itemRarity = "";
      let itemSlot = "";

      if (isAsset) {
        const asset = await findAssetByNumber(itemNumber);
        if (!asset || !asset.market?.isMarket || asset.owner === buyer) {
          await this.refundMarketPurchase(job, price, "LISTING_GONE: listing no longer active");
          await this.finalizeDead(job, "market", "LISTING_GONE: listing no longer active");
          return;
        }
        seller = asset.owner;
        itemName = asset.name;
        itemRarity = asset.rarity ?? "";
        itemSlot = asset.kind ?? "";
      } else {
        const item = await findItemByNumber(itemNumber);
        if (!item || !item.market?.isMarket || item.owner === buyer) {
          await this.refundMarketPurchase(job, price, "LISTING_GONE: listing no longer active");
          await this.finalizeDead(job, "market", "LISTING_GONE: listing no longer active");
          return;
        }
        seller = item.owner as string;
        itemName = item.name;
        itemRarity = item.rarity ?? "";
        itemSlot = item.slot ?? "";
      }

      const { claimed } = await claimProcessedTransaction({
        txHash: paymentTxId,
        wallet: buyer,
        type: "market_purchase",
        amount: -price,
        metadata: {
          type: "market_purchase",
          itemNumber,
          itemType: job.itemType ?? itemSlot ?? "item",
          seller,
          price,
          fee,
        },
      });
      if (!claimed) {
        logger.info("market payment already settled (idempotent)", {
          buyer,
          itemNumber,
          paymentTxId,
        });
        await completeJob(id);
        return;
      }

      // 3 — transfer ownership (clears market field atomically), then pay seller.
      let transferOk = false;
      let transferError = "";
      if (isAsset) {
        const t = await transferAsset(itemNumber, seller, buyer);
        transferOk = t.ok;
        transferError = t.error ?? "";
      } else {
        const t = await transferOwnership(itemNumber, seller, buyer);
        transferOk = t.ok;
        transferError = t.error ?? "";
      }

      if (!transferOk) {
        await this.refundMarketPurchase(
          job,
          price,
          `NOT_FOUND: ${transferError || "transfer failed"}`,
        );
        await this.finalizeDead(job, "market", `NOT_FOUND: ${transferError || "transfer failed"}`);
        return;
      }

      const payout = await this.sendOnChain(seller, sellerProceeds, paymentTxId);

      const detail = { itemNumber, price, fee, name: itemName, rarity: itemRarity };
      await createLog({
        type: "market",
        wallet: buyer,
        target: seller,
        amount: -price,
        txHash: paymentTxId,
        data: { action: "bought", ...detail },
      });
      await createLog({
        type: "market",
        wallet: seller,
        target: buyer,
        amount: sellerProceeds,
        txHash: payout.signature,
        data: { action: "sold", ...detail },
      });

      void incrementStat("totalMarketSales");

      await completeJob(id);
      logger.info("settled market purchase", {
        buyer,
        seller,
        itemNumber,
        price,
        payout: payout.signature,
      });
    } catch (err) {
      await this.retryOrDie(job, "market", err);
    }
  }

  /**
   * Pays the buyer back on-chain when a purchase cannot be honoured.
   * Best-effort: a failed refund is logged loudly for manual settlement.
   */
  private async refundMarketPurchase(
    job: IInboundTransaction,
    amount: number,
    reason: string,
  ): Promise<void> {
    if (amount <= 0 || job.refunded) return;
    const buyer = job.walletAddress;
    const ref = job.paymentTxId ?? job.signature;
    try {
      const refund = await this.sendOnChain(buyer, amount, `refund:${ref}`);
      job.refunded = true;
      await insertProcessedTransaction({
        txHash: `refund:${ref}`,
        wallet: buyer,
        type: "market_purchase",
        amount,
        metadata: {
          type: "market_purchase",
          itemNumber: job.itemNumber ?? 0,
          itemType: job.itemType ?? "item",
          seller: "refund",
          price: amount,
          fee: 0,
        },
      });
      await createLog({
        type: "market",
        wallet: buyer,
        amount,
        txHash: refund.signature,
        data: {
          action: "refunded",
          itemNumber: job.itemNumber,
          reason,
          jobId: String(job._id),
        },
      });
      logger.warn("refunded market purchase", {
        buyer,
        amount,
        itemNumber: job.itemNumber,
        reason,
      });
    } catch (err) {
      await createErrorLog({
        type: "market",
        wallet: buyer,
        error: `REFUND_FAILED: ${message(err)}`,
        data: {
          jobId: String(job._id),
          amount,
          itemNumber: job.itemNumber,
          paymentTxId: ref,
          reason,
        },
      });
      logger.error("market refund FAILED — needs manual payout", {
        buyer,
        amount,
        itemNumber: job.itemNumber,
        paymentTxId: ref,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Terminal outcome for a pending job: record it as a "failed" row in
   * transactions-processed (idempotent on the job's own signature) and
   * remove it from transactions-pending. This runs for every non-retryable
   * error and every job that exhausts its retries, so a pending document
   * never lingers past its terminal state — it's either still actively
   * pending/retrying, or it's gone and accounted for here.
   */
  private async finalizeDead(
    job: IInboundTransaction,
    label: string,
    reason: string,
  ): Promise<void> {
    const id = String(job._id);
    const amount = job.withdrawAmount ?? job.depositAmount ?? job.price ?? 0;

    let metadata: ProcessedTxMetadata | undefined;
    if (job.type === "withdrawal") {
      metadata = { type: "withdrawal", payoutTxHash: "" };
    } else if (job.type === "deposit") {
      metadata = { type: "deposit", creditedAmount: 0 };
    } else {
      metadata = {
        type: "market_purchase",
        itemNumber: job.itemNumber ?? 0,
        itemType: job.itemType ?? "item",
        seller: "",
        price: amount,
        fee: 0,
      };
    }

    await recordFailedTransaction({
      txHash: job.signature,
      wallet: job.walletAddress,
      type: job.type,
      amount,
      error: reason,
      metadata,
    });
    await completeJob(id);
    await createErrorLog({
      type: label,
      wallet: job.walletAddress,
      error: reason,
      data: { dead: true, jobId: id },
    });
    logger.warn(`dead-lettered ${label} — removed from pending queue`, {
      wallet: job.walletAddress,
      reason,
    });
  }

  private async retryOrDie(job: IInboundTransaction, label: string, err: unknown): Promise<void> {
    const id = String(job._id);
    const code = errorCode(err);
    if (code && NON_RETRYABLE.has(code)) {
      await this.finalizeDead(job, label, `${code}: ${message(err)}`);
      return;
    }
    const dead = await failJob(id, message(err), this.maxRetries);
    if (dead) {
      await this.finalizeDead(job, label, message(err));
      return;
    }
    await createErrorLog({
      type: label,
      wallet: job.walletAddress,
      error: message(err),
      data: { dead: false, jobId: id },
    });
    logger.warn(`${label} retry scheduled`, { wallet: job.walletAddress });
  }
}

export async function logQueueDepth(): Promise<void> {
  const counts = await countJobsByStatus();
  logger.info("queue depth", counts);
}
