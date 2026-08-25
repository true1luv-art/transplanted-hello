/**
 * server/smart-contract/services/payouts.service.ts
 *
 * Distribution of a VERIFIED incoming mint payment.
 *
 *   worker -> MintPayoutService -> BlockchainService -> lib/chain/hive.ts -> Hive
 *
 * Responsibilities:
 *   - decide deterministically WHO gets HOW MUCH (integer-safe milli math)
 *   - never distribute more than the verified payment
 *   - never pay the same leg twice, even when a job is retried
 *
 * The private active key never leaves `lib/chain/hive.ts`.
 *
 * SERVER-ONLY.
 */
import { formatAsset, splitAmount, toMilli } from "@/lib/chain/amounts";
import { config } from "@/lib/config/config";
import { HIVE_CURRENCY } from "@/lib/constants";
import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import type {
  PayoutLeg,
  PayoutRecord,
  PendingTransaction,
} from "@/lib/modules/transactions-pending/types.server";
import type { BlockchainService } from "../blockchain.service";
import { TransientTransactionError, errorMessage } from "../lib/errors";

export interface MintPayoutPlan {
  /** The verified payment being distributed. */
  total: number;
  creator: { account: string; amount: number };
  platform: { account: string; amount: number };
}

/**
 * Splits a verified mint payment into the creator payout and the platform fee.
 * `creator + platform === total` by construction (the fee is floored and the
 * creator receives the remainder), so a mint can never over-distribute.
 */
export function planMintPayout(
  total: number,
  creatorAccount: string,
  platformPercent = config.fees.platformMintFeePercent,
): MintPayoutPlan {
  const split = splitAmount(total, platformPercent);
  return {
    total: split.total,
    creator: { account: creatorAccount, amount: split.counterparty },
    platform: { account: config.fees.platformAccount, amount: split.platform },
  };
}

/** true when the plan is internally consistent — asserted before any transfer. */
export function isPlanBalanced(plan: MintPayoutPlan): boolean {
  return toMilli(plan.creator.amount) + toMilli(plan.platform.amount) <= toMilli(plan.total);
}

/** Distribution of a VERIFIED marketplace payment. */
export interface SalePayoutPlan {
  total: number;
  seller: { account: string; amount: number };
  platform: { account: string; amount: number };
}

/**
 * Splits a verified sale payment into the seller proceeds and the marketplace
 * fee. `seller + platform === total` by construction.
 */
export function planSalePayout(
  total: number,
  sellerAccount: string,
  platformPercent = config.fees.marketplaceFeePercent,
): SalePayoutPlan {
  const split = splitAmount(total, platformPercent);
  return {
    total: split.total,
    seller: { account: sellerAccount, amount: split.counterparty },
    platform: { account: config.fees.platformAccount, amount: split.platform },
  };
}

/** true when a sale plan never distributes more than the verified payment. */
export function isSalePlanBalanced(plan: SalePayoutPlan): boolean {
  return toMilli(plan.seller.amount) + toMilli(plan.platform.amount) <= toMilli(plan.total);
}

interface PlannedLeg {
  leg: PayoutLeg;
  account: string;
  amount: number;
  memo: string;
}

export class MintPayoutService {
  readonly name = "MintPayoutService";

  constructor(private readonly chain: BlockchainService) {}

  /**
   * Executes the outstanding legs of a payout plan.
   *
   * Idempotency: every completed leg is persisted on the pending document
   * before the next leg runs, so a retry resumes where it stopped instead of
   * paying anyone twice. Already-recorded legs are returned untouched.
   */
  async distribute(tx: PendingTransaction, plan: MintPayoutPlan): Promise<PayoutRecord[]> {
    if (!isPlanBalanced(plan)) {
      throw new Error("Payout plan distributes more than the verified payment");
    }
    return this.run(tx, [
      {
        leg: "creator",
        account: plan.creator.account,
        amount: plan.creator.amount,
        memo: `HiveMint mint payout · ${tx.transactionId}`,
      },
      {
        leg: "platform",
        account: plan.platform.account,
        amount: plan.platform.amount,
        memo: `HiveMint platform fee · ${tx.transactionId}`,
      },
    ]);
  }

  /**
   * Settles a verified marketplace sale: seller proceeds first, marketplace
   * fee second. Same leg-by-leg persistence, so a worker restart between the
   * two legs never pays the seller twice.
   */
  async distributeSale(tx: PendingTransaction, plan: SalePayoutPlan): Promise<PayoutRecord[]> {
    if (!isSalePlanBalanced(plan)) {
      throw new Error("Payout plan distributes more than the verified payment");
    }
    return this.run(tx, [
      {
        leg: "seller",
        account: plan.seller.account,
        amount: plan.seller.amount,
        memo: `HiveMint sale proceeds · ${tx.transactionId}`,
      },
      {
        leg: "platform",
        account: plan.platform.account,
        amount: plan.platform.amount,
        memo: `HiveMint marketplace fee · ${tx.transactionId}`,
      },
    ]);
  }

  private async run(tx: PendingTransaction, legs: PlannedLeg[]): Promise<PayoutRecord[]> {
    const done = [...(tx.payouts ?? [])];
    const paid = (leg: PayoutLeg) => done.some((p) => p.leg === leg);

    for (const leg of legs) {
      if (paid(leg.leg)) continue;
      // Zero-value legs are recorded, never broadcast (Hive rejects 0.000).
      if (toMilli(leg.amount) === 0) {
        done.push(await this.record(tx, { leg: leg.leg, account: leg.account, amount: 0 }));
        continue;
      }

      // Self-payment is a no-op: the platform already holds the funds.
      if (leg.account === config.fees.platformAccount && leg.leg === "platform") {
        done.push(
          await this.record(tx, {
            leg: leg.leg,
            account: leg.account,
            amount: leg.amount,
            hiveTransactionId: "retained",
          }),
        );
        continue;
      }

      let hiveTransactionId: string;
      try {
        const result = await this.chain.transfer({
          from: config.fees.platformAccount,
          to: leg.account,
          amount: leg.amount,
          currency: HIVE_CURRENCY,
          memo: leg.memo,
        });
        hiveTransactionId = result.hiveTransactionId;
      } catch (error) {
        // A payout failure is environmental: the incoming payment is already
        // verified, so the job must be retried rather than dead-lettered.
        throw new TransientTransactionError(
          `Payout to @${leg.account} of ${formatAsset(leg.amount)} failed: ${errorMessage(error)}`,
          "PAYOUT_FAILED",
        );
      }
      done.push(
        await this.record(tx, {
          leg: leg.leg,
          account: leg.account,
          amount: leg.amount,
          hiveTransactionId,
        }),
      );
    }

    return done;
  }

  private async record(
    tx: PendingTransaction,
    entry: Omit<PayoutRecord, "paidAt">,
  ): Promise<PayoutRecord> {
    const record: PayoutRecord = { ...entry, paidAt: new Date().toISOString() };
    await transactionsPendingRepository.recordPayout(tx.id, record);
    tx.payouts = [...(tx.payouts ?? []), record];
    return record;
  }
}
