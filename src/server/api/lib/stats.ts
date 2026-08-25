import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import { usersRepository } from "@/lib/modules/users/repository.server";
import { activityRepository } from "@/lib/modules/activity/repository.server";

export async function computeStats() {
  const collections = await nftCollectionsRepository.listAll();
  const totalVolume = collections.reduce((sum, c) => sum + c.volume, 0);
  const floors = collections.map((c) => c.floorPrice).filter((p) => p > 0);
  const [nfts, listings, users, activity] = await Promise.all([
    nftsRepository.count(),
    nftsRepository.countListed(),
    usersRepository.count(),
    activityRepository.count(),
  ]);
  return {
    collections: collections.length,
    nfts,
    activeListings: listings,
    users,
    activity,
    totalVolume: Number(totalVolume.toFixed(3)),
    floorPrice: floors.length ? Math.min(...floors) : 0,
    trending: collections
      .slice()
      .sort((x, y) => y.trendingScore - x.trendingScore)
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        image: c.image,
        floorPrice: c.floorPrice,
        volume: c.volume,
        minted: c.minted,
        maxSupply: c.maxSupply,
        trendingScore: c.trendingScore,
      })),
  };
}
