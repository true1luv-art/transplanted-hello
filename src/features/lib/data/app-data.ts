/**
 * Local (LocalStorage) data implementation — the mock DATABASE.
 *
 * This is the storage driver for the client-side domain modules — the same
 * role `lib/config/database.ts` plays on the server. Only module repositories
 * are allowed to touch it: features and UI never import this file directly.
 *
 * Every key it owns lives under the `MOCK_DB_PREFIX` namespace so a reset can
 * never wipe unrelated application storage. Replacing this driver with MongoDB
 * later only touches the repositories, never the feature actions.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DB_VERSION, migrateAppData } from "@/features/lib/data/migrations";

import type { Activity, Transaction } from "@/features/types/domain/activity";
import type { Collection } from "@/features/types/domain/collections";
import type { Listing } from "@/features/types/domain/marketplace";
import type { NftAsset } from "@/features/types/domain/nft-assets";
import type { NFT } from "@/features/types/domain/nfts";
import type { MintTransactionRecord } from "@/features/types/domain/mint";
import type { BalanceLedger, User } from "@/features/types/domain/users";
import { CURRENT_USER, createSeedData } from "./seed-data";

/** Namespace for every LocalStorage key owned by the mock database. */
export const MOCK_DB_PREFIX = "hivex.mockdb.";
export const MOCK_DB_KEY = `${MOCK_DB_PREFIX}app-v1`;

export interface AppData {
  user: User | null;
  walletConnected: boolean;
  hiveBalance: number;
  balances: BalanceLedger;
  collections: Collection[];
  /** Prepared, unminted NFT records (`nft-assets`). */
  nftAssets: NftAsset[];
  nfts: NFT[];
  listings: Listing[];
  transactions: Transaction[];
  /** Journal of REAL Hive mint attempts (pending -> confirmed/failed). */
  mintTransactions: MintTransactionRecord[];
  activities: Activity[];
  /** Unminted imported NFTs, keyed by collection id. */
  unminted: Record<string, NFT[]>;
  connecting: boolean;
}

export interface AppDataStore extends AppData {
  /** Primitive mutators — no business rules live here. */
  patch: (partial: Partial<AppData>) => void;
  update: (updater: (state: AppData) => Partial<AppData>) => void;
}

export const BASE_BALANCES: BalanceLedger = {
  [CURRENT_USER.username]: 125.5,
  bob: 940.2,
  charlie: 512.75,
  david: 288.4,
  eve: 1_204.0,
};

/**
 * The database starts EMPTY. Collections, NFT assets, NFTs, listings and
 * activity are only created by going through the application itself.
 */
export function createInitialData(): AppData {
  return {
    user: CURRENT_USER,
    walletConnected: true,
    hiveBalance: 125.5,
    balances: { ...BASE_BALANCES },
    collections: [],
    nftAssets: [],
    nfts: [],
    listings: [],
    transactions: [],
    mintTransactions: [],
    activities: [],
    unminted: {},
    connecting: false,
  };
}

/**
 * Fully populated demo dataset. NOT used at initialization — kept for tests and
 * for an explicit, user-triggered demo import.
 */
export function createDemoData(): AppData {
  const seed = createSeedData();
  return {
    ...createInitialData(),
    collections: seed.collections,
    nfts: seed.nfts,
    listings: seed.listings,
    transactions: seed.transactions,
    activities: seed.activities,
  };
}

/** Storage stand-in for SSR and tests, where `localStorage` does not exist. */
const memoryStorage: Storage = (() => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
})();

const driver = (): Storage =>
  typeof window === "undefined" ? memoryStorage : window.localStorage;

export const useAppData = create<AppDataStore>()(
  persist(
    (set) => ({
      ...createInitialData(),
      patch: (partial) => set(partial),
      update: (updater) => set((state) => updater(state)),
    }),
    {
      name: MOCK_DB_KEY,
      storage: createJSONStorage(driver),
      // Data-preserving schema upgrades: older payloads are transformed,
      // never wiped. See lib/data/migrations.ts.
      version: DB_VERSION,
      migrate: (persisted, fromVersion) => migrateAppData(persisted, fromVersion) as AppData,

      skipHydration: true,
      partialize: (s) => ({
        user: s.user,
        walletConnected: s.walletConnected,
        hiveBalance: s.hiveBalance,
        balances: s.balances,
        collections: s.collections,
        nftAssets: s.nftAssets,
        nfts: s.nfts,
        listings: s.listings,
        transactions: s.transactions,
        activities: s.activities,
        unminted: s.unminted,
      }),
    },
  ),
);

/** Non-React accessors used by module repositories. */
export const appData = {
  read: (): AppData => useAppData.getState(),
  patch: (partial: Partial<AppData>) => useAppData.getState().patch(partial),
  update: (updater: (state: AppData) => Partial<AppData>) => useAppData.getState().update(updater),
  /** Resets to an empty database and drops every namespaced key. */
  clear: (): void => {
    const storage = driver();
    for (const key of Object.keys(storage)) {
      if (key.startsWith(MOCK_DB_PREFIX)) storage.removeItem(key);
    }
    useAppData.getState().patch(createInitialData());
  },
};
