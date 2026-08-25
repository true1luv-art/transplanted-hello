import { connectDatabase } from "@/lib/config/database";
import { ActivityModel, createActivityDocument } from "./model.server";
import type { ActivityDocument, CreateActivityInput } from "./types.server";

/**
 * Activity repository — the append-only log of everything that happened,
 * indexed by actor (Hive account), collection and NFT.
 *
 * SERVER-ONLY.
 */
class ActivityRepository {
  async record(input: CreateActivityInput): Promise<ActivityDocument> {
    await connectDatabase();
    const doc = createActivityDocument(input);
    await ActivityModel.create(doc);
    return doc;
  }

  /**
   * Idempotent activity write. A replayed transaction must never produce a
   * second row, so the (transactionId, type) pair is the natural key. Records
   * without a transaction id fall back to a plain insert.
   */
  async recordOnce(input: CreateActivityInput): Promise<ActivityDocument> {
    if (!input.transactionId) return this.record(input);
    await connectDatabase();
    const existing = await ActivityModel.findOne({
      transactionId: input.transactionId,
      type: input.type,
    })
      .lean<ActivityDocument | null>()
      .exec();
    if (existing) return existing;
    return this.record(input);
  }

  async insertMany(docs: ActivityDocument[]): Promise<ActivityDocument[]> {
    if (docs.length === 0) return [];
    await connectDatabase();
    await ActivityModel.insertMany(docs);
    return docs;
  }

  private async listSorted(
    filter: Record<string, unknown>,
    limit: number,
  ): Promise<ActivityDocument[]> {
    await connectDatabase();
    return ActivityModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<ActivityDocument[]>()
      .exec();
  }

  listRecent(limit = 100) {
    return this.listSorted({}, limit);
  }

  listByCollection(collectionId: string, limit = 50) {
    return this.listSorted({ collectionId }, limit);
  }

  listByNft(nftId: string, limit = 50) {
    return this.listSorted({ nftId }, limit);
  }

  listByActor(actor: string, limit = 50) {
    return this.listSorted({ actor }, limit);
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    await connectDatabase();
    return ActivityModel.countDocuments(filter).exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await ActivityModel.deleteMany({}).exec();
  }
}

export const activityRepository = new ActivityRepository();
