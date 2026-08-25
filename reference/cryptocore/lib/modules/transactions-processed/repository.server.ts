// src/lib/modules/transactions-processed/repository.server.ts
import { ProcessedTransactionModel } from "./model.server";
import type { IProcessedTransaction, ProcessedTxType, ProcessedTxMetadata } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

function isDuplicate(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

export async function insertProcessedTransaction(input: {
  txHash: string;
  wallet: string;
  type: ProcessedTxType;
  amount: number;
  metadata?: ProcessedTxMetadata;
}): Promise<void> {
  await connectDatabase();
  try {
    await ProcessedTransactionModel.create({
      txHash: input.txHash,
      wallet: input.wallet,
      type: input.type,
      amount: input.amount,
      processedAt: Date.now(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  } catch (err) {
    if (isDuplicate(err)) return;
    throw err;
  }
}

/**
 * Records a permanently dead-lettered pending job as a "failed" outcome.
 * Called right before the job is removed from transactions-pending so every
 * pending document is either still in-flight (pending/failed-retrying) or
 * has a terminal record here — never stale/orphaned once settlement ends.
 * Idempotent on txHash like the other insert helpers.
 */
export async function recordFailedTransaction(input: {
  txHash: string;
  wallet: string;
  type: ProcessedTxType;
  amount: number;
  error: string;
  metadata?: ProcessedTxMetadata;
}): Promise<void> {
  await connectDatabase();
  try {
    await ProcessedTransactionModel.create({
      txHash: input.txHash,
      wallet: input.wallet,
      type: input.type,
      amount: input.amount,
      status: "failed",
      error: input.error.slice(0, 500),
      processedAt: Date.now(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
  } catch (err) {
    if (isDuplicate(err)) return;
    throw err;
  }
}

export async function claimProcessedTransaction(input: {
  txHash: string;
  wallet: string;
  type: ProcessedTxType;
  amount: number;
  metadata?: ProcessedTxMetadata;
}): Promise<{ claimed: boolean }> {
  await connectDatabase();
  try {
    await ProcessedTransactionModel.create({
      txHash: input.txHash,
      wallet: input.wallet,
      type: input.type,
      amount: input.amount,
      processedAt: Date.now(),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
    return { claimed: true };
  } catch (err) {
    if (isDuplicate(err)) return { claimed: false };
    throw err;
  }
}

export async function isTransactionProcessed(txHash: string): Promise<boolean> {
  await connectDatabase();
  const count = await ProcessedTransactionModel.countDocuments({ txHash }).limit(1);
  return count > 0;
}

export async function getTransactionHistory(
  wallet: string,
  limit: number,
  cursor?: number,
  type?: ProcessedTxType,
): Promise<{ transactions: IProcessedTransaction[]; nextCursor: number | null }> {
  await connectDatabase();
  const filter: Record<string, unknown> = { wallet };
  if (type) filter["type"] = type;
  if (cursor != null) filter["processedAt"] = { $lt: cursor };

  const rows = await ProcessedTransactionModel.find(filter)
    .sort({ processedAt: -1 })
    .limit(limit + 1)
    .lean<IProcessedTransaction[]>();

  const hasMore = rows.length > limit;
  const transactions = hasMore ? rows.slice(0, limit) : rows;
  const last = transactions[transactions.length - 1];
  const nextCursor = hasMore && last ? last.processedAt : null;
  return { transactions, nextCursor };
}
