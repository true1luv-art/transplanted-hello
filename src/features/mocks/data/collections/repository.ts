import { appData } from "@/features/lib/data/app-data";
import type { NFT } from "@/features/types/domain/nfts";
import { applyMint, applySale } from "@/features/mocks/data/collections/model";
import type { Collection } from "@/features/types/domain/collections";

/** Data access for collections. The only module allowed to read/write storage. */
export const collectionsRepository = {
  list(): Collection[] {
    return appData.read().collections;
  },

  findById(id: string): Collection | undefined {
    return appData.read().collections.find((c) => c.id === id);
  },

  listByCreator(creator: string): Collection[] {
    return appData.read().collections.filter((c) => c.creator === creator);
  },

  insert(collection: Collection): Collection {
    appData.update((s) => ({ collections: [collection, ...s.collections] }));
    return collection;
  },

  update(id: string, patch: Partial<Collection>): void {
    appData.update((s) => ({
      collections: s.collections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  recordMint(id: string, paid: number): void {
    appData.update((s) => ({
      collections: s.collections.map((c) => (c.id === id ? applyMint(c, paid) : c)),
    }));
  },

  recordSale(id: string, price: number): void {
    appData.update((s) => ({
      collections: s.collections.map((c) => (c.id === id ? applySale(c, price) : c)),
    }));
  },

};
