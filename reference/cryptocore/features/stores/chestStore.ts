import "@/features/stores/legacyStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChestKey } from "@/features/types/game";

type ChestCounts = Partial<Record<ChestKey, number>>;

interface ChestState {
  opened: ChestCounts;
  totalSpent: number;
  recordOpen: (chest: ChestKey, price: number) => void;
  reset: () => void;
}

export const useChestStore = create<ChestState>()(
  persist(
    (set) => ({
      opened: {},
      totalSpent: 0,
      recordOpen: (chest, price) =>
        set((state) => ({
          opened: { ...state.opened, [chest]: (state.opened[chest] ?? 0) + 1 },
          totalSpent: state.totalSpent + price,
        })),
      reset: () => set({ opened: {}, totalSpent: 0 }),
    }),
    { name: "cryptocore.chests", version: 1 },
  ),
);
