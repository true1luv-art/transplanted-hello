import { appData } from "@/features/lib/data/app-data";
import type { NftAsset } from "@/features/types/domain/nft-assets";

/**
 * Data access for prepared (unminted) NFT assets — the only module allowed to
 * read/write the `nftAssets` collection of the local database. Swapping the
 * LocalStorage driver for MongoDB later means reimplementing this file, not the
 * feature actions that call it.
 */
export const nftAssetsRepository = {
  list(): NftAsset[] {
    return appData.read().nftAssets;
  },

  findById(id: string): NftAsset | undefined {
    return appData.read().nftAssets.find((asset) => asset.id === id);
  },

  listByCollection(collectionId: string): NftAsset[] {
    return appData
      .read()
      .nftAssets.filter((asset) => asset.collectionId === collectionId)
      .sort((a, b) => a.NFTMintId - b.NFTMintId);
  },

  countByCollection(collectionId: string): number {
    return appData.read().nftAssets.filter((asset) => asset.collectionId === collectionId).length;
  },

  insert(asset: NftAsset): NftAsset {
    appData.update((state) => ({ nftAssets: [...state.nftAssets, asset] }));
    return asset;
  },

  insertMany(assets: NftAsset[]): NftAsset[] {
    appData.update((state) => ({ nftAssets: [...state.nftAssets, ...assets] }));
    return assets;
  },

  patch(id: string, patch: Partial<NftAsset>): NftAsset | undefined {
    appData.update((state) => ({
      nftAssets: state.nftAssets.map((asset) =>
        asset.id === id ? { ...asset, ...patch, updatedAt: new Date().toISOString() } : asset,
      ),
    }));
    return this.findById(id);
  },

  remove(id: string): void {
    appData.update((state) => ({
      nftAssets: state.nftAssets.filter((asset) => asset.id !== id),
    }));
  },

  removeByCollection(collectionId: string): void {
    appData.update((state) => ({
      nftAssets: state.nftAssets.filter((asset) => asset.collectionId !== collectionId),
    }));
  },
};
