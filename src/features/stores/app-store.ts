/**
 * App store facade.
 *
 * Read state comes from the local data implementation; every write is a
 * feature action from `features/<domain>/*`. Components never touch
 * repositories or storage directly.
 */
import { buyNft } from "@/features/events/buy-nft/action";
import { cancelListing } from "@/features/events/cancel-listing/action";
import { connectWallet, disconnectWallet } from "@/features/events/connect-wallet/action";
import { createCollection } from "@/features/events/create-collection/action";
import { listNft } from "@/features/events/list-nft/action";
import { mintNft } from "@/features/events/mint-nft/action";
import { mintNftOnChain, recoverPendingMints } from "@/features/events/mint-nft-onchain/action";
import type { MintNftAssetInput } from "@/features/lib/mint/hive-mint.service";
import { resetDemoData } from "@/features/events/reset-demo-data/action";
import { syncHiveProfile } from "@/features/events/sync-hive-profile/action";
import { transferNft } from "@/features/events/transfer-nft/action";
import type { CreateCollectionInput } from "@/features/types/collection";
import { type AppData, useAppData } from "@/features/lib/data/app-data";

const actions = {
  connectWallet: async (username?: string) => {
    await connectWallet(username ? { username } : {});
    // Hydrate the session with real Hive profile data (non-fatal on failure).
    await syncHiveProfile();
  },
  syncHiveProfile: async () => {
    await syncHiveProfile();
  },
  disconnectWallet,
  createCollection: (input: CreateCollectionInput) => createCollection(input),
  mintNFT: (collectionId: string) => mintNft({ collectionId }),
  /** REAL Hive mint: prepares, signs with Keychain and indexes the token. */
  mintNftOnChain: (input: MintNftAssetInput) => mintNftOnChain(input),
  /** Re-queries Hive for broadcasted mints whose token id was not read yet. */
  recoverPendingMints: () => recoverPendingMints(),
  listNFT: (nftId: string, price: number) => listNft({ nftId, price }),
  cancelListing: (listingId: string) => cancelListing({ listingId }),
  buyNFT: async (listingId: string) => {
    await buyNft({ listingId });
  },
  transferNFT: (nftId: string, to: string) => transferNft({ nftId, to }),
  resetMockData: resetDemoData,
} as const;

export type AppStoreView = AppData & typeof actions;

const view = (state: AppData): AppStoreView => ({ ...state, ...actions });

export function useAppStore<T>(selector: (state: AppStoreView) => T): T {
  return useAppData((state) => selector(view(state)));
}

useAppStore.getState = (): AppStoreView => view(useAppData.getState());
useAppStore.persist = useAppData.persist;
useAppStore.actions = actions;
