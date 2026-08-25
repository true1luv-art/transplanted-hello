/**
 * Database seeding.
 *
 * Converts the deterministic mock catalogue into MongoDB-shaped index
 * documents. Safe to run repeatedly — it is a no-op when data already exists
 * unless `force` is passed.
 */
import { logger } from "@/lib/config/logger";
import { nowIso } from "@/lib/config/helpers";
import { createSeedData, CURRENT_USER, USERS } from "@/features/lib/data/seed-data";
import { activityRepository } from "@/lib/modules/activity/repository.server";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { mockCid } from "@/features/mocks/mock-ipfs";
import { nftAssetsRepository } from "@/lib/modules/nft-assets/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { transactionsProcessedRepository } from "@/lib/modules/transactions-processed/repository.server";
import { usersRepository } from "@/lib/modules/users/repository.server";
import type { CollectionDocument } from "@/lib/modules/collections/types.server";
import type { NftDocument } from "@/lib/modules/nfts/types.server";
import { hiveNftId } from "@/lib/modules/nfts/model.server";
import type { ActivityDocument } from "@/lib/modules/activity/types.server";

export interface SeedResult {
  seeded: boolean;
  counts: Record<string, number>;
}

export async function seedDatabase(options: { force?: boolean } = {}): Promise<SeedResult> {
  const existing = await nftCollectionsRepository.count();
  if (existing > 0 && !options.force) {
    return { seeded: false, counts: await currentCounts() };
  }

  if (options.force) {
    await Promise.all([
      nftCollectionsRepository.clear(),
      nftsRepository.clear(),
      activityRepository.clear(),
      usersRepository.clear(),
      transactionsPendingRepository.clear(),
      transactionsProcessedRepository.clear(),
      nftAssetsRepository.clear(),
    ]);
  }

  const data = createSeedData();
  const timestamp = nowIso();

  const collections: CollectionDocument[] = data.collections.map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    description: c.description,
    image: c.image,
    creator: c.creator,
    maxSupply: c.maxSupply,
    minted: c.minted,
    mintPrice: c.mintPrice,
    currency: "HIVE",
    creatorFee: c.creatorFee,
    platformFee: c.platformFee,
    metadataBaseUri: c.metadataBaseUri,
    status: c.minted >= c.maxSupply ? "sold_out" : "active",
    creationState: "ACTIVE",
    // Seeded collections behave as if their assets were already pinned.
    collectionImageUri: `ipfs://${mockCid(`seed-image-${c.id}`)}`,
    collectionMetadataUri: `ipfs://${mockCid(`seed-collection-metadata-${c.id}`)}`,
    assetRootUri: `ipfs://${mockCid(`seed-assets-${c.id}`)}`,
    metadataRootUri: `ipfs://${mockCid(`seed-metadata-${c.id}`)}`,
    assetCount: 0,
    reusableAssets: true,
    floorPrice: c.floorPrice,
    volume: c.volume,
    holders: c.holders,
    trendingScore: c.trendingScore,
    createdAt: c.createdAt,
    updatedAt: timestamp,
  }));

  // Listings are CACHED market state on the NFT itself — HiveMint keeps no
  // listings collection; Hive owns the market.
  const listingByNft = new Map(data.listings.map((l) => [l.nftId, l]));
  const symbolByCollection = new Map(collections.map((c) => [c.id, c.symbol]));

  const nfts: NftDocument[] = data.nfts.map((n) => {
    const listing = listingByNft.get(n.id);
    return {
      id: n.id,
      collectionId: n.collectionId,
      collectionName: n.collectionName,
      tokenId: n.tokenId ?? n.mintNumber,
      hiveNftId: hiveNftId(
        symbolByCollection.get(n.collectionId) ?? "HIVEMINT",
        n.tokenId ?? n.mintNumber,
      ),
      name: n.name,
      description: n.description,
      image: n.image,
      owner: n.owner,
      traits: n.traits,
      rarityScore: n.rarityScore,
      rarityRank: n.rarityRank,
      rarityRankTotal: n.rarityRankTotal,
      mintNumber: n.mintNumber,
      NFTMintId: n.mintNumber,
      NFTokenID: n.tokenId ?? null,
      maxSupply: n.maxSupply,
      metadataUri: n.metadataUri,
      attributes: n.attributes,
      estimatedValue: n.estimatedValue,
      status: listing ? "listed" : "owned",
      isListed: Boolean(listing),
      listingPrice: listing?.price,
      listingCurrency: listing ? ("HIVE" as const) : undefined,
      listingSeller: listing?.seller,
      listedAt: listing?.listedAt,
      listingTransactionId: listing ? `SEED-MARKET-${listing.id}` : undefined,
      marketSyncedAt: timestamp,
      mintTransactionId: `SEED-${n.id}`,
      createdAt: n.createdAt,
      updatedAt: timestamp,
    };
  });

  const activities: ActivityDocument[] = data.activities.map((a) => ({
    id: a.id,
    type: a.type,
    actor: a.actor,
    target: a.target,
    nftId: a.nftId,
    collectionId: a.collectionId,
    label: a.label,
    amount: a.amount,
    transactionId: a.txId,
    hiveTransactionId: a.txId,
    createdAt: a.createdAt,
  }));

  await nftCollectionsRepository.insertMany(collections);
  await nftsRepository.insertMany(nfts);
  await activityRepository.insertMany(activities);

  // Accounts: the dev user plus every account referenced by the catalogue.
  const accounts = new Set<string>([
    CURRENT_USER.username,
    ...USERS,
    ...collections.map((c) => c.creator),
  ]);
  for (const username of accounts) {
    await usersRepository.ensure({
      username,
      ledgerBalance: username === CURRENT_USER.username ? 1250 : 500,
    });
  }

  const counts = await currentCounts();
  logger.info("DB", "Seed complete", counts);
  return { seeded: true, counts };
}

async function currentCounts() {
  const [collections, nfts, listings, activity, users] = await Promise.all([
    nftCollectionsRepository.count(),
    nftsRepository.count(),
    nftsRepository.countListed(),
    activityRepository.count(),
    usersRepository.count(),
  ]);
  return { collections, nfts, listings, activity, users };
}

let bootstrapped: Promise<SeedResult> | null = null;

/** Called once per server process before the first API read. */
export function ensureSeeded(): Promise<SeedResult> {
  if (!bootstrapped) bootstrapped = seedDatabase();
  return bootstrapped;
}
