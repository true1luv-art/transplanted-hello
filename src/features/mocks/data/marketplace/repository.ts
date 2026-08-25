import { appData } from "@/features/lib/data/app-data";
import type { Listing } from "@/features/types/domain/marketplace";

export const marketplaceRepository = {
  list(): Listing[] {
    return appData.read().listings;
  },

  findById(id: string): Listing | undefined {
    return appData.read().listings.find((l) => l.id === id);
  },

  findByNft(nftId: string): Listing | undefined {
    return appData.read().listings.find((l) => l.nftId === nftId);
  },

  insert(listing: Listing): Listing {
    appData.update((s) => ({ listings: [listing, ...s.listings] }));
    return listing;
  },

  remove(id: string): void {
    appData.update((s) => ({ listings: s.listings.filter((l) => l.id !== id) }));
  },

  removeByNft(nftId: string): void {
    appData.update((s) => ({ listings: s.listings.filter((l) => l.nftId !== nftId) }));
  },
};
