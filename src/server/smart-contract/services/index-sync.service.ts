/**
 * server/smart-contract/services/index-sync.service.ts
 *
 * Synchronizes the MongoDB INDEX with facts already verified on Hive.
 *
 *   Hive (source of truth) -> worker verification -> IndexSyncService -> MongoDB
 *
 * Responsibilities:
 *   - NFT ownership synchronization
 *   - cached market state on the `nfts` document (isListed + listing fields)
 *   - collection statistics (floor, holders, volume)
 *   - revalidating the cached market state against Hive
 *
 * HiveMint does not run its own marketplace: there is no listings collection.
 * Everything written here is an index/cache that Hive can overrule.
 *
 * SERVER-ONLY.
 */
import { fetchHiveListing } from "@/lib/chain/market";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import type { ActivityDocumentType } from "@/lib/modules/activity/types.server";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import type { NftDocument } from "@/lib/modules/nfts/types.server";
import { usersRepository } from "@/lib/modules/users/repository.server";

const round = (value: number) => Number(value.toFixed(3));

export interface ActivityEntry {
  type: ActivityDocumentType;
  actor: string;
  target?: string | undefined;
  nftId?: string | undefined;
  collectionId?: string | undefined;
  label: string;
  amount?: number | undefined;
  transactionId: string;
  hiveTransactionId?: string | undefined;
}

export class IndexSyncService {
  readonly name = "IndexSyncService";

  /* ---------------------------------------------------------------- */
  /* ownership                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Applies a verified ownership change. Idempotent: when the index already
   * shows the new owner (a replay), nothing is written again.
   */
  async applyOwnership(
    nftId: string,
    newOwner: string,
    estimatedValue?: number,
  ): Promise<{ changed: boolean }> {
    const nft = await nftsRepository.findById(nftId);
    if (!nft) return { changed: false };
    if (nft.owner === newOwner) return { changed: false };
    await usersRepository.ensure({ username: newOwner });
    await nftsRepository.transferOwnership(nftId, newOwner, estimatedValue);
    return { changed: true };
  }

  /* ---------------------------------------------------------------- */
  /* cached market state                                               */
  /* ---------------------------------------------------------------- */

  /**
   * Caches a verified Hive listing on the NFT. Idempotent: replaying the same
   * application transaction leaves the cache untouched.
   */
  async cacheListing(input: {
    transactionId: string;
    nftId: string;
    seller: string;
    price: number;
  }): Promise<{ nft: NftDocument | null; changed: boolean }> {
    const nft = await nftsRepository.findById(input.nftId);
    if (!nft) return { nft: null, changed: false };
    if (nft.isListed && nft.listingTransactionId === input.transactionId)
      return { nft, changed: false };

    const updated = await nftsRepository.markListed(nft.id, {
      price: round(input.price),
      seller: input.seller,
      transactionId: input.transactionId,
    });
    return { nft: updated ?? nft, changed: true };
  }

  /** Clears the cached listing (sold, cancelled or invalidated). Idempotent. */
  async clearListing(nftId: string): Promise<{ changed: boolean }> {
    const nft = await nftsRepository.findById(nftId);
    if (!nft || !nft.isListed) return { changed: false };
    await nftsRepository.markUnlisted(nftId);
    return { changed: true };
  }

  /**
   * Refreshes the cached market state of one NFT from Hive. Hive wins on every
   * disagreement — the cache is only an accelerator for UI/API reads.
   */
  async revalidateMarketState(nftId: string): Promise<NftDocument | null> {
    const nft = await nftsRepository.findById(nftId);
    if (!nft) return null;
    const [symbol, tokenId] = nft.hiveNftId.split(":");
    if (!symbol) return nft;

    const listing = await fetchHiveListing({ symbol, tokenId: Number(tokenId ?? nft.tokenId) });
    if (!listing) {
      if (!nft.isListed) return nft;
      return (await nftsRepository.markUnlisted(nft.id)) ?? nft;
    }
    return (
      (await nftsRepository.markListed(nft.id, {
        price: listing.price,
        seller: listing.seller,
        transactionId: nft.listingTransactionId ?? "hive",
        ...(listing.listedAt ? { listedAt: listing.listedAt } : {}),
      })) ?? nft
    );
  }

  /* ---------------------------------------------------------------- */
  /* collection statistics                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Recomputes derived collection stats from the index itself, so repeated
   * runs converge on the same values instead of accumulating drift.
   */
  async syncCollectionStats(
    collectionId: string,
    options: { addVolume?: number | undefined } = {},
  ): Promise<void> {
    const collection = await nftCollectionsRepository.findById(collectionId);
    if (!collection) return;

    const listed = await nftsRepository.listListedByCollection(collectionId);
    const prices = listed.map((nft) => nft.listingPrice ?? 0).filter((price) => price > 0);
    const floorPrice = prices.length ? Math.min(...prices) : 0;
    const holders = await nftsRepository.countHolders(collectionId);
    const volume =
      options.addVolume && options.addVolume > 0
        ? round(collection.volume + options.addVolume)
        : collection.volume;

    await nftCollectionsRepository.patch(collectionId, {
      floorPrice: round(floorPrice),
      holders,
      volume,
    });
  }

  /** Number of currently listed NFTs in a collection (collection page stat). */
  listedCount(collectionId: string): Promise<number> {
    return nftsRepository.countListed(collectionId);
  }

  /* ---------------------------------------------------------------- */
  /* activity                                                          */
  /* ---------------------------------------------------------------- */

  /** Records activity exactly once per (transactionId, type). */
  async recordActivity(entry: ActivityEntry): Promise<void> {
    await activityRepository.recordOnce(entry);
  }
}

export const indexSync = new IndexSyncService();
