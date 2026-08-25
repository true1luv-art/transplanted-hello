import { appData } from "@/features/lib/data/app-data";
import type { NFT } from "@/features/types/domain/nfts";

export const nftsRepository = {
  list(): NFT[] {
    return appData.read().nfts;
  },

  findById(id: string): NFT | undefined {
    return appData.read().nfts.find((n) => n.id === id);
  },

  listByOwner(owner: string): NFT[] {
    return appData.read().nfts.filter((n) => n.owner === owner);
  },

  listByCollection(collectionId: string): NFT[] {
    return appData.read().nfts.filter((n) => n.collectionId === collectionId);
  },

  insert(nft: NFT): NFT {
    appData.update((s) => ({ nfts: [nft, ...s.nfts] }));
    return nft;
  },

  update(id: string, patch: Partial<NFT>): void {
    appData.update((s) => ({ nfts: s.nfts.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  },
};
