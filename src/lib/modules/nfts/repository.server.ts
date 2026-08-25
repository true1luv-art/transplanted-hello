import { connectDatabase, toUpdate } from "@/lib/config/database";
import { nowIso } from "@/lib/config/helpers";
import { HELD_STATUSES, NftModel } from "./model.server";
import type { NftDocument } from "./types.server";

/**
 * NFTs repository — Mongoose queries over the `nfts` index.
 *
 * Listing state is a CACHE of on-chain market state stored on the NFT
 * document (`isListed`, `listingPrice`, …). Hive stays authoritative.
 *
 * SERVER-ONLY.
 */

export interface ListingCacheInput {
  price: number;
  seller: string;
  currency?: "HIVE" | undefined;
  listedAt?: string | undefined;
  transactionId?: string | undefined;
}

type SortDir = 1 | -1;

class NftsRepository {
  async find(
    filter: Record<string, unknown> = {},
    sort?: Record<string, SortDir>,
    limit?: number,
  ): Promise<NftDocument[]> {
    await connectDatabase();
    let query = NftModel.find(filter);
    if (sort) query = query.sort(sort);
    if (limit !== undefined) query = query.limit(limit);
    return query.lean<NftDocument[]>().exec();
  }

  async findOne(filter: Record<string, unknown>): Promise<NftDocument | null> {
    await connectDatabase();
    return NftModel.findOne(filter).lean<NftDocument | null>().exec();
  }

  findById(id: string) {
    return this.findOne({ id });
  }

  listAll() {
    return this.find();
  }

  /** Alias kept for existing callers. */
  list() {
    return this.find();
  }

  listByCollection(collectionId: string) {
    return this.find({ collectionId }, { mintNumber: 1 });
  }

  listByOwner(owner: string) {
    return this.find({ owner }, { createdAt: -1 });
  }

  listListed() {
    return this.find({ isListed: true }, { listedAt: -1 });
  }

  listListedByCollection(collectionId: string) {
    return this.find({ isListed: true, collectionId }, { listedAt: -1 });
  }

  listListedBySeller(seller: string) {
    return this.find({ isListed: true, listingSeller: seller }, { listedAt: -1 });
  }

  async insert(doc: NftDocument): Promise<NftDocument> {
    await connectDatabase();
    await NftModel.create(doc);
    return doc;
  }

  async insertMany(docs: NftDocument[]): Promise<NftDocument[]> {
    if (docs.length === 0) return [];
    await connectDatabase();
    await NftModel.insertMany(docs);
    return docs;
  }

  create(doc: NftDocument) {
    return this.insert(doc);
  }

  async patch(id: string, updates: Partial<NftDocument>): Promise<NftDocument | null> {
    await connectDatabase();
    return NftModel.findOneAndUpdate({ id }, toUpdate({ ...updates, updatedAt: nowIso() }), {
      new: true,
    })
      .lean<NftDocument | null>()
      .exec();
  }

  /** Next token id: `max(tokenId) + 1` within the collection (1-based). */
  async nextTokenId(collectionId: string): Promise<number> {
    const [top] = await this.find({ collectionId }, { tokenId: -1 }, 1);
    return (top?.tokenId ?? 0) + 1;
  }

  /** Next mint number: `max(mintNumber) + 1` within the collection. */
  async nextMintNumber(collectionId: string): Promise<number> {
    const [top] = await this.find({ collectionId }, { mintNumber: -1 }, 1);
    return (top?.mintNumber ?? 0) + 1;
  }

  /** Caches a listing observed on (or broadcast to) Hive. */
  markListed(id: string, listing: ListingCacheInput) {
    const timestamp = nowIso();
    return this.patch(id, {
      status: "listed",
      isListed: true,
      listingPrice: listing.price,
      listingCurrency: listing.currency ?? "HIVE",
      listingSeller: listing.seller,
      listedAt: listing.listedAt ?? timestamp,
      listingTransactionId: listing.transactionId,
      marketSyncedAt: timestamp,
    });
  }

  /** Clears the cached listing state (delist / sale / burn). */
  markUnlisted(id: string) {
    return this.patch(id, {
      status: "owned",
      isListed: false,
      listingPrice: undefined,
      listingCurrency: undefined,
      listingSeller: undefined,
      listedAt: undefined,
      listingTransactionId: undefined,
      marketSyncedAt: nowIso(),
    });
  }

  transferOwnership(id: string, newOwner: string, estimatedValue?: number) {
    return this.patch(id, {
      owner: newOwner,
      status: "owned",
      isListed: false,
      listingPrice: undefined,
      listingCurrency: undefined,
      listingSeller: undefined,
      listedAt: undefined,
      listingTransactionId: undefined,
      ...(estimatedValue !== undefined ? { estimatedValue } : {}),
    });
  }

  /** Distinct owner count over held NFTs (`owned` + `listed`). */
  async countHolders(collectionId: string): Promise<number> {
    await connectDatabase();
    const owners = await NftModel.distinct("owner", {
      collectionId,
      status: { $in: HELD_STATUSES },
    }).exec();
    return owners.length;
  }

  countListed(collectionId?: string): Promise<number> {
    return this.count({ isListed: true, ...(collectionId ? { collectionId } : {}) });
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    await connectDatabase();
    return NftModel.countDocuments(filter).exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await NftModel.deleteMany({}).exec();
  }
}

export const nftsRepository = new NftsRepository();
