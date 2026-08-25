// src/lib/modules/transactions-pending/repository.server.ts
import { randomUUID } from "crypto";
import { InboundTransactionModel } from "./model.server";
import type { IInboundTransaction, InboundTxStatus } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

const DEFAULT_MAX_RETRIES = 8;

export async function enqueueWithdrawal(input: {
  walletAddress: string;
  withdrawAmount: number;
}): Promise<{ jobId: string; signature: string }> {
  await connectDatabase();
  const signature = randomUUID();
  const doc = await InboundTransactionModel.create({
    type: "withdrawal",
    signature,
    walletAddress: input.walletAddress,
    withdrawAmount: input.withdrawAmount,
    status: "pending",
    retryCount: 0,
  });
  return { jobId: String(doc._id), signature };
}

export async function enqueueDeposit(input: {
  walletAddress: string;
  depositAmount: number;
  depositTxId: string;
}): Promise<{ jobId: string; duplicate: boolean }> {
  await connectDatabase();
  try {
    const doc = await InboundTransactionModel.create({
      type: "deposit",
      signature: input.depositTxId,
      walletAddress: input.walletAddress,
      depositAmount: input.depositAmount,
      depositTxId: input.depositTxId,
      status: "pending",
      retryCount: 0,
    });
    return { jobId: String(doc._id), duplicate: false };
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return { jobId: "", duplicate: true };
    throw err;
  }
}

/**
 * Marketplace purchases are paid on-chain, so the payment signature is the
 * queue's idempotency key — the same transfer can never settle twice.
 */
export async function enqueueMarketPurchase(input: {
  walletAddress: string;
  itemNumber: number;
  itemType: string;
  price: number;
  paymentTxId: string;
}): Promise<{ jobId: string; signature: string; duplicate: boolean }> {
  await connectDatabase();
  try {
    const doc = await InboundTransactionModel.create({
      type: "market_purchase",
      signature: input.paymentTxId,
      walletAddress: input.walletAddress,
      itemNumber: input.itemNumber,
      itemType: input.itemType,
      price: input.price,
      paymentTxId: input.paymentTxId,
      status: "pending",
      retryCount: 0,
    });
    return { jobId: String(doc._id), signature: input.paymentTxId, duplicate: false };
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      return { jobId: "", signature: input.paymentTxId, duplicate: true };
    }
    throw err;
  }
}

export async function listPendingOldestFirst(limit = 0): Promise<IInboundTransaction[]> {
  await connectDatabase();
  const q = InboundTransactionModel.find({
    status: { $in: ["pending", "failed"] satisfies InboundTxStatus[] },
  }).sort({ createdAt: 1 });
  if (limit > 0) q.limit(limit);
  return q.exec();
}

export async function findPendingByWallet(
  wallet: string,
  limit = 25,
): Promise<IInboundTransaction[]> {
  await connectDatabase();
  return InboundTransactionModel.find({ walletAddress: wallet })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function completeJob(id: string): Promise<void> {
  await connectDatabase();
  await InboundTransactionModel.deleteOne({ _id: id });
}

export async function failJob(
  id: string,
  message: string,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<boolean> {
  await connectDatabase();
  const doc = await InboundTransactionModel.findById(id);
  if (!doc) return false;
  doc.retryCount += 1;
  doc.lastError = message.slice(0, 500);
  const dead = doc.retryCount >= maxRetries;
  doc.status = dead ? "dead" : "failed";
  await doc.save();
  return dead;
}

export async function countJobsByStatus(): Promise<Record<string, number>> {
  await connectDatabase();
  const rows = await InboundTransactionModel.aggregate<{ _id: string; n: number }>([
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r._id] = r.n;
    return acc;
  }, {});
}
