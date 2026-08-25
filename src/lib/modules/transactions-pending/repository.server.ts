import { connectDatabase, isDuplicateKeyError, toUpdate } from "@/lib/config/database";
import { nowIso } from "@/lib/config/helpers";
import { PendingTransactionModel, createPendingDocument } from "./model.server";
import type {
  CreatePendingTransactionInput,
  PayoutRecord,
  PendingTransaction,
  PendingTransactionStatus,
  TransactionType,
} from "./types.server";

/**
 * Pending transactions repository — the durable work queue.
 *
 * `claimNext` leases one document atomically (`pending` -> `processing`) so
 * two workers can never process the same transaction. Stale leases are
 * recovered by `recoverStale`.
 *
 * SERVER-ONLY.
 */
class TransactionsPendingRepository {
  async findOne(filter: Record<string, unknown>): Promise<PendingTransaction | null> {
    await connectDatabase();
    return PendingTransactionModel.findOne(filter).lean<PendingTransaction | null>().exec();
  }

  findById(id: string) {
    return this.findOne({ id });
  }

  findByTransactionId(transactionId: string) {
    return this.findOne({ transactionId });
  }

  findByRequestId(requestId: string) {
    return this.findOne({ requestId });
  }

  /**
   * Idempotent enqueue on `requestId`: a replayed client request returns the
   * original transaction instead of queuing a second one.
   */
  async enqueue<T extends TransactionType>(
    input: CreatePendingTransactionInput<T>,
  ): Promise<{ transaction: PendingTransaction; duplicate: boolean }> {
    const existing = await this.findByRequestId(input.requestId);
    if (existing) return { transaction: existing, duplicate: true };

    const doc = createPendingDocument(input);
    try {
      await PendingTransactionModel.create(doc);
      return { transaction: doc, duplicate: false };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const replayed = await this.findByRequestId(input.requestId);
        if (replayed) return { transaction: replayed, duplicate: true };
      }
      throw error;
    }
  }

  private async listSorted(
    filter: Record<string, unknown>,
    dir: 1 | -1,
    limit: number,
  ): Promise<PendingTransaction[]> {
    await connectDatabase();
    return PendingTransactionModel.find(filter)
      .sort({ createdAt: dir })
      .limit(limit)
      .lean<PendingTransaction[]>()
      .exec();
  }

  listPending(limit = 50) {
    return this.listSorted({ status: "pending" }, 1, limit);
  }

  listByStatus(status: PendingTransactionStatus, limit = 50) {
    return this.listSorted({ status }, -1, limit);
  }

  listForUser(hiveAccount: string, limit = 50) {
    return this.listSorted({ hiveAccount }, -1, limit);
  }

  /** Atomically leases the oldest queued transaction to one worker. */
  async claimNext(workerId: string): Promise<PendingTransaction | null> {
    await connectDatabase();
    const timestamp = nowIso();
    return PendingTransactionModel.findOneAndUpdate(
      { status: "pending" },
      {
        $set: {
          status: "processing",
          lockedBy: workerId,
          lockedAt: timestamp,
          updatedAt: timestamp,
        },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { createdAt: 1 } },
    )
      .lean<PendingTransaction | null>()
      .exec();
  }

  /** Returns leases older than `staleMs` to the queue. */
  async recoverStale(staleMs: number): Promise<number> {
    await connectDatabase();
    const cutoff = new Date(Date.now() - staleMs).toISOString();
    const result = await PendingTransactionModel.updateMany(
      { status: "processing", lockedAt: { $lt: cutoff } },
      {
        $set: { status: "pending", updatedAt: nowIso() },
        $unset: { lockedBy: 1, lockedAt: 1 },
      },
    ).exec();
    return result.modifiedCount;
  }

  async update(
    filter: Record<string, unknown>,
    patch: Partial<PendingTransaction>,
  ): Promise<PendingTransaction | null> {
    await connectDatabase();
    return PendingTransactionModel.findOneAndUpdate(filter, toUpdate(patch), { new: true })
      .lean<PendingTransaction | null>()
      .exec();
  }

  updateById(id: string, patch: Partial<PendingTransaction>) {
    return this.update({ id }, patch);
  }

  /** Terminal state reached — the queue document is removed. */
  async finalize(id: string): Promise<boolean> {
    await connectDatabase();
    const result = await PendingTransactionModel.deleteOne({ id }).exec();
    return result.deletedCount > 0;
  }

  /** Transient failure: back to `pending` for another attempt. */
  scheduleRetry(id: string, error: string) {
    return this.updateById(id, {
      status: "pending",
      error,
      lockedBy: undefined,
      lockedAt: undefined,
      updatedAt: nowIso(),
    });
  }

  /** Appends a settled payout leg so a retry never pays twice. */
  async recordPayout(id: string, payout: PayoutRecord): Promise<PendingTransaction | null> {
    await connectDatabase();
    return PendingTransactionModel.findOneAndUpdate(
      { id },
      { $push: { payouts: payout }, $set: { updatedAt: nowIso() } },
      { new: true },
    )
      .lean<PendingTransaction | null>()
      .exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    await connectDatabase();
    return PendingTransactionModel.countDocuments(filter).exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await PendingTransactionModel.deleteMany({}).exec();
  }
}

export const transactionsPendingRepository = new TransactionsPendingRepository();
