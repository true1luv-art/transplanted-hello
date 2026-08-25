import { connectDatabase, isDuplicateKeyError, toUpdate } from "@/lib/config/database";
import { nowIso } from "@/lib/config/helpers";
import { CollectionModel, statusExpression } from "./model.server";
import type { CollectionDocument } from "./types.server";

/**
 * Collections repository — Mongoose queries over the `nft_collections`
 * collection.
 *
 * Supply and sale counters use atomic update pipelines so concurrent mints
 * and sales cannot overrun `maxSupply` or double-count volume.
 *
 * SERVER-ONLY.
 */
class NftCollectionsRepository {
  async find(filter: Record<string, unknown> = {}): Promise<CollectionDocument[]> {
    await connectDatabase();
    return CollectionModel.find(filter).lean<CollectionDocument[]>().exec();
  }

  async findOne(filter: Record<string, unknown>): Promise<CollectionDocument | null> {
    await connectDatabase();
    return CollectionModel.findOne(filter).lean<CollectionDocument | null>().exec();
  }

  findById(id: string) {
    return this.findOne({ id });
  }

  findBySymbol(symbol: string) {
    return this.findOne({ symbol: symbol.toUpperCase() });
  }

  listAll() {
    return this.find();
  }

  /** Alias kept for existing callers. */
  list() {
    return this.find();
  }

  async listTrending(limit = 24): Promise<CollectionDocument[]> {
    await connectDatabase();
    return CollectionModel.find({ status: "active" })
      .sort({ trendingScore: -1 })
      .limit(limit)
      .lean<CollectionDocument[]>()
      .exec();
  }

  listByCreator(creator: string) {
    return this.find({ creator });
  }

  async insert(doc: CollectionDocument): Promise<CollectionDocument> {
    await connectDatabase();
    await CollectionModel.create(doc);
    return doc;
  }

  async insertMany(docs: CollectionDocument[]): Promise<CollectionDocument[]> {
    if (docs.length === 0) return [];
    await connectDatabase();
    await CollectionModel.insertMany(docs);
    return docs;
  }

  create(doc: CollectionDocument) {
    return this.insert(doc);
  }

  /** Insert when the symbol is free; returns the existing document otherwise. */
  async ensureSymbol(
    doc: CollectionDocument,
  ): Promise<{ doc: CollectionDocument; created: boolean }> {
    try {
      return { doc: await this.insert(doc), created: true };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findBySymbol(doc.symbol);
        if (existing) return { doc: existing, created: false };
      }
      throw error;
    }
  }

  async patch(
    id: string,
    updates: Partial<CollectionDocument>,
  ): Promise<CollectionDocument | null> {
    await connectDatabase();
    return CollectionModel.findOneAndUpdate(
      { id },
      toUpdate({ ...updates, updatedAt: nowIso() }),
      { new: true },
    )
      .lean<CollectionDocument | null>()
      .exec();
  }

  /**
   * Atomic supply guard: increments `minted` only while supply remains and
   * flips status to `sold_out` at the limit. Returns the updated document plus
   * the reserved mint number, or null when sold out / unknown.
   */
  async reserveMint(id: string): Promise<(CollectionDocument & { mintNumber: number }) | null> {
    const mintedExpr = { $add: ["$minted", 1] };
    const doc = await this.pipeline(
      { id, $expr: { $lt: ["$minted", "$maxSupply"] } },
      { minted: mintedExpr, status: statusExpression(mintedExpr) },
    );
    if (!doc) return null;
    return { ...doc, mintNumber: doc.minted };
  }

  /** Rolls back a reservation when the mint itself fails. */
  async releaseMint(id: string): Promise<CollectionDocument | null> {
    const mintedExpr = { $subtract: ["$minted", 1] };
    const doc = await this.pipeline(
      { id, minted: { $gt: 0 } },
      { minted: mintedExpr, status: statusExpression(mintedExpr) },
    );
    return doc ?? this.findById(id);
  }

  /** Adds traded volume (HIVE). */
  addVolume(id: string, amount: number) {
    return this.pipeline({ id }, { volume: { $round: [{ $add: ["$volume", amount] }, 3] } });
  }

  /** Atomically increments minted supply; optionally adds primary-sale volume. */
  incrementMinted(id: string, volume = 0) {
    const mintedExpr = { $add: ["$minted", 1] };
    return this.pipeline(
      { id },
      {
        minted: mintedExpr,
        status: statusExpression(mintedExpr),
        ...(volume > 0 ? { volume: { $round: [{ $add: ["$volume", volume] }, 3] } } : {}),
      },
    );
  }

  /** Records a secondary sale: volume += price, floor = min(floor, price). */
  registerSale(id: string, price: number) {
    return this.pipeline(
      { id },
      {
        volume: { $round: [{ $add: ["$volume", price] }, 3] },
        floorPrice: {
          $cond: [{ $eq: ["$floorPrice", 0] }, price, { $min: ["$floorPrice", price] }],
        },
      },
    );
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    await connectDatabase();
    return CollectionModel.countDocuments(filter).exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await CollectionModel.deleteMany({}).exec();
  }

  /** Runs a `$set` aggregation-pipeline update and returns the new document. */
  private async pipeline(
    filter: Record<string, unknown>,
    set: Record<string, unknown>,
  ): Promise<CollectionDocument | null> {
    await connectDatabase();
    return CollectionModel.findOneAndUpdate(
      filter,
      [{ $set: { ...set, updatedAt: nowIso() } }],
      { new: true },
    )
      .lean<CollectionDocument | null>()
      .exec();
  }
}

export const nftCollectionsRepository = new NftCollectionsRepository();
