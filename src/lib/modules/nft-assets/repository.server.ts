import { connectDatabase, toUpdate } from "@/lib/config/database";
import { nowIso } from "@/lib/config/helpers";
import { NftAssetModel } from "./model.server";
import type { NftAssetDocument } from "./types.server";

/**
 * NFT assets repository — Mongoose queries over `nft_assets`.
 *
 * Rows are written at collection creation (after IPFS upload) and consumed
 * lazily at mint time: `reserveForMint` claims the requested token (or the
 * lowest-numbered unminted one) atomically so concurrent mints never receive
 * the same asset. A verified mint deletes the row — the token then lives in
 * the `nfts` index.
 *
 * SERVER-ONLY.
 */
class NftAssetsRepository {
  async findById(id: string): Promise<NftAssetDocument | null> {
    await connectDatabase();
    return NftAssetModel.findOne({ id }).lean<NftAssetDocument | null>().exec();
  }

  async listByCollection(collectionId: string): Promise<NftAssetDocument[]> {
    await connectDatabase();
    return NftAssetModel.find({ collectionId })
      .sort({ NFTMintId: 1 })
      .lean<NftAssetDocument[]>()
      .exec();
  }

  async insertMany(docs: NftAssetDocument[]): Promise<NftAssetDocument[]> {
    if (docs.length === 0) return [];
    await connectDatabase();
    await NftAssetModel.insertMany(docs);
    return docs;
  }

  countByCollection(collectionId: string) {
    return this.count({ collectionId });
  }

  countUnminted(collectionId: string) {
    return this.count({ collectionId, status: "unminted" });
  }

  /**
   * Claims an asset row for a mint. Prefers the requested token number, then
   * falls back to the lowest unminted row. Returns null when nothing is left.
   */
  async reserveForMint(
    collectionId: string,
    NFTMintId: number | undefined,
    transactionId: string,
  ): Promise<NftAssetDocument | null> {
    await connectDatabase();
    const timestamp = nowIso();
    const patch = toUpdate({
      status: "reserved",
      reservedBy: transactionId,
      reservedAt: timestamp,
      updatedAt: timestamp,
    });

    if (NFTMintId !== undefined) {
      const claimed = await NftAssetModel.findOneAndUpdate(
        { collectionId, NFTMintId, status: "unminted" },
        patch,
        { new: true },
      )
        .lean<NftAssetDocument | null>()
        .exec();
      if (claimed) return claimed;
    }

    return NftAssetModel.findOneAndUpdate({ collectionId, status: "unminted" }, patch, {
      new: true,
      sort: { NFTMintId: 1 },
    })
      .lean<NftAssetDocument | null>()
      .exec();
  }

  /** Rolls back a reservation when the mint fails. */
  async release(id: string): Promise<NftAssetDocument | null> {
    await connectDatabase();
    return NftAssetModel.findOneAndUpdate(
      { id },
      toUpdate({
        status: "unminted",
        reservedBy: undefined,
        reservedAt: undefined,
        updatedAt: nowIso(),
      }),
      { new: true },
    )
      .lean<NftAssetDocument | null>()
      .exec();
  }

  /** Consumes a reserved asset after a verified mint: the row is removed. */
  async consume(id: string): Promise<boolean> {
    await connectDatabase();
    const result = await NftAssetModel.deleteOne({ id }).exec();
    return result.deletedCount > 0;
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    await connectDatabase();
    return NftAssetModel.countDocuments(filter).exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await NftAssetModel.deleteMany({}).exec();
  }
}

export const nftAssetsRepository = new NftAssetsRepository();
