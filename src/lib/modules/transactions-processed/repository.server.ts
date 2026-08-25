import { connectDatabase, isDuplicateKeyError } from "@/lib/config/database";
import { ProcessedTransactionModel, createProcessedDocument } from "./model.server";
import type {
  CreateProcessedTransactionInput,
  ProcessedTransaction,
} from "./types.server";

/**
 * Processed transactions repository — the append-only receipt log.
 *
 * `record` is idempotent on `transactionId`: a replayed write returns the
 * original receipt instead of creating a second one.
 *
 * SERVER-ONLY.
 */
class TransactionsProcessedRepository {
  async findOne(filter: Record<string, unknown>): Promise<ProcessedTransaction | null> {
    await connectDatabase();
    return ProcessedTransactionModel.findOne(filter)
      .lean<ProcessedTransaction | null>()
      .exec();
  }

  findByTransactionId(transactionId: string) {
    return this.findOne({ transactionId });
  }

  findByRequestId(requestId: string) {
    return this.findOne({ requestId });
  }

  async record(input: CreateProcessedTransactionInput): Promise<ProcessedTransaction> {
    const existing = await this.findByTransactionId(input.transactionId);
    if (existing) return existing;

    const doc = createProcessedDocument(input);
    try {
      await ProcessedTransactionModel.create(doc);
      return doc;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const replayed = await this.findByTransactionId(input.transactionId);
        if (replayed) return replayed;
      }
      throw error;
    }
  }

  private async listSorted(
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<ProcessedTransaction[]> {
    await connectDatabase();
    return ProcessedTransactionModel.find(filter)
      .sort({ processedAt: -1 })
      .limit(limit)
      .lean<ProcessedTransaction[]>()
      .exec();
  }

  listRecent(limit = 50) {
    return this.listSorted({}, limit);
  }

  listForActor(hiveAccount: string, limit = 50) {
    return this.listSorted({ hiveAccount }, limit);
  }

  listFailed(limit = 50) {
    return this.listSorted({ status: "failed" }, limit);
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    await connectDatabase();
    return ProcessedTransactionModel.countDocuments(filter).exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await ProcessedTransactionModel.deleteMany({}).exec();
  }
}

export const transactionsProcessedRepository = new TransactionsProcessedRepository();
