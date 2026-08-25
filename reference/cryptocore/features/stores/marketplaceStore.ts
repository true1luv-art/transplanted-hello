import "@/features/stores/legacyStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { RARITY_KEYS, SLOT_KEYS } from "@/features/constants/game";
import { generateEquipment } from "@/features/game/equipment";
import { pickOne } from "@/features/game/random";
import { equipmentScore } from "@/features/game/stats";
import { createId } from "@/features/game/random";
import type { Equipment, Rarity, SlotKey } from "@/features/types/game";

export const MARKET_FEE = 0.05;

const NPC_SELLERS = [
  "blockjack",
  "hashqueen",
  "rug_pull",
  "nodefather",
  "satoshiii",
  "coldwallet",
  "whalebag",
  "satslayer",
  "hashbandit",
];

/** Milliseconds after which NPCs start buying a player listing. */
const NPC_BUY_DELAY_MS = 15 * 60 * 1000;

export interface MarketListing {
  id: string;
  item: Equipment;
  price: number;
  seller: string;
  listedAt: number;
  /** NPC listings are regenerated; player listings are owned by the user. */
  isNpc: boolean;
}

export const suggestedPrice = (item: Equipment): number =>
  Math.max(1, Math.round(equipmentScore(item) * 6 + item.level * 4));

const generateNpcListing = (index: number): MarketListing => {
  const item = generateEquipment({ rarity: pickOne(RARITY_KEYS), slot: pickOne(SLOT_KEYS) });
  const score = equipmentScore(item);
  const price = Math.max(5, Math.round(score * 12 + item.level * 8));
  return {
    id: createId("ml"),
    item,
    price,
    seller: NPC_SELLERS[index % NPC_SELLERS.length]!,
    listedAt: Date.now(),
    isNpc: true,
  };
};

interface MarketplaceState {
  listings: MarketListing[];
  npcSeedAt: number;

  listItem: (item: Equipment, price: number, seller: string) => void;
  buy: (id: string) => { item: Equipment; price: number } | null;
  cancel: (id: string) => Equipment | null;
  refreshMarket: () => { bought: number; credits: number };
  reset: () => void;
}

export const useMarketplaceStore = create<MarketplaceState>()(
  persist(
    (set, get) => ({
      listings: [],
      npcSeedAt: 0,

      listItem: (item, price, seller) => {
        const listing: MarketListing = {
          id: createId("ml"),
          item: { ...item, equipped: false },
          price,
          seller,
          listedAt: Date.now(),
          isNpc: false,
        };
        set((state) => ({ listings: [listing, ...state.listings] }));
      },

      buy: (id) => {
        const listing = get().listings.find((l) => l.id === id);
        if (!listing) return null;
        set((state) => ({ listings: state.listings.filter((l) => l.id !== id) }));
        return { item: listing.item, price: listing.price };
      },

      cancel: (id) => {
        const listing = get().listings.find((l) => l.id === id && !l.isNpc);
        if (!listing) return null;
        set((state) => ({ listings: state.listings.filter((l) => l.id !== id) }));
        return listing.item;
      },

      refreshMarket: () => {
        const now = Date.now();
        const state = get();

        // NPCs buy player listings that have been sitting around long enough.
        let credits = 0;
        let bought = 0;
        const playerListings = state.listings.filter((l) => !l.isNpc);
        const remaining = state.listings.filter((l) => {
          if (l.isNpc) return true;
          const age = now - l.listedAt;
          if (age < NPC_BUY_DELAY_MS) return true;
          // 40% chance per refresh that an NPC buys the listing.
          const sold = Math.random() < 0.4;
          if (sold) {
            credits += l.price * (1 - MARKET_FEE);
            bought++;
          }
          return !sold;
        });

        // Keep any still-fresh player listings, drop old NPC listings, and seed new NPC stock.
        const playerOnly = remaining.filter((l) => !l.isNpc);
        const npcListings = Array.from({ length: 12 }, (_, i) => generateNpcListing(i));

        set({
          listings: [...playerOnly, ...npcListings],
          npcSeedAt: now,
        });

        return { bought, credits };
      },

      reset: () => set({ listings: [], npcSeedAt: 0 }),
    }),
    { name: "cryptocore.marketplace", version: 1 },
  ),
);

export const marketListingSort = (
  a: MarketListing,
  b: MarketListing,
  key: "price" | "score" | "level" | "listed",
  dir: "asc" | "desc",
): number => {
  const scoreA = equipmentScore(a.item);
  const scoreB = equipmentScore(b.item);
  let diff = 0;
  if (key === "price") diff = a.price - b.price;
  else if (key === "score") diff = scoreA - scoreB;
  else if (key === "level") diff = a.item.level - b.item.level;
  else diff = a.listedAt - b.listedAt;
  return dir === "asc" ? diff : -diff;
};

export const filterListings = (
  listings: MarketListing[],
  filters: {
    query?: string | undefined;
    slot?: SlotKey | "all" | undefined;
    rarities?: Rarity[] | undefined;
    maxPrice?: number | undefined;
    ownOnly?: boolean | undefined;
  },
): MarketListing[] => {
  const query = filters.query?.trim().toLowerCase() ?? "";
  return listings.filter(({ item, price, isNpc }) => {
    if (query && !item.name.toLowerCase().includes(query)) return false;
    if (filters.slot && filters.slot !== "all" && item.slot !== filters.slot) return false;
    if (filters.rarities?.length && !filters.rarities.includes(item.rarity)) return false;
    if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
    if (filters.ownOnly && isNpc) return false;
    return true;
  });
};
