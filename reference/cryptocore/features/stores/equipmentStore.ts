import "@/features/stores/legacyStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import * as api from "@/lib/api/client";
import { SLOT_KEYS } from "@/features/constants/game";
import { itemDtoToEquipment } from "@/features/game/item-mapper";
import { upgradedItem } from "@/features/game/items";
import type { Equipment, SlotKey } from "@/features/types/game";

type EquippedMap = Record<SlotKey, string | null>;

const emptyEquipped = (): EquippedMap =>
  SLOT_KEYS.reduce((acc, slot) => ({ ...acc, [slot]: null }), {} as EquippedMap);

interface EquipmentState {
  inventory: Equipment[];
  equipped: EquippedMap;
  addItem: (item: Equipment) => void;
  equip: (id: string) => Equipment | null;
  unequip: (slot: SlotKey) => void;
  upgradeItem: (id: string) => Equipment | null;
  removeItem: (id: string) => void;
  /**
   * Pulls the real, server-authoritative item list for a wallet session and
   * replaces the local cache with it. Without this, the persisted local
   * store never self-corrects — e.g. an item removed locally by a bug (or
   * any other client/server drift) stays wrong forever, since nothing ever
   * re-reads `/api/items`. Listed-for-sale items are excluded: they're
   * pending a sale, not available gear.
   */
  syncFromApi: () => Promise<boolean>;
  reset: () => void;
}

export const useEquipmentStore = create<EquipmentState>()(
  persist(
    (set, get) => ({
      inventory: [],
      equipped: emptyEquipped(),

      addItem: (item) => set((state) => ({ inventory: [item, ...state.inventory] })),

      equip: (id) => {
        const item = get().inventory.find((entry) => entry.id === id);
        if (!item) return null;
        set((state) => ({
          equipped: { ...state.equipped, [item.slot]: item.id },
          inventory: state.inventory.map((entry) =>
            entry.slot === item.slot ? { ...entry, equipped: entry.id === item.id } : entry,
          ),
        }));
        return item;
      },

      unequip: (slot) =>
        set((state) => ({
          equipped: { ...state.equipped, [slot]: null },
          inventory: state.inventory.map((entry) =>
            entry.slot === slot ? { ...entry, equipped: false } : entry,
          ),
        })),

      upgradeItem: (id) => {
        const item = get().inventory.find((entry) => entry.id === id);
        if (!item) return null;
        const next = upgradedItem(item);
        set((state) => ({
          inventory: state.inventory.map((entry) => (entry.id === id ? next : entry)),
        }));
        return next;
      },

      removeItem: (id) =>
        set((state) => {
          const item = state.inventory.find((entry) => entry.id === id);
          const equipped = { ...state.equipped };
          if (item && equipped[item.slot] === id) equipped[item.slot] = null;
          return { inventory: state.inventory.filter((entry) => entry.id !== id), equipped };
        }),

      syncFromApi: async () => {
        const result = await api.getInventory();
        if (!result.ok || !result.items) return false;

        // Actively-listed items are pending a sale — keep them off the
        // equippable/sellable gear grid until the listing is cancelled or sold.
        const owned = result.items.filter((dto) => !dto.market?.isMarket);
        const inventory = owned.map(itemDtoToEquipment);
        const equipped = emptyEquipped();
        for (const item of inventory) {
          if (item.equipped) equipped[item.slot] = item.id;
        }
        set({ inventory, equipped });
        return true;
      },

      reset: () => set({ inventory: [], equipped: emptyEquipped() }),
    }),
    { name: "cryptocore.equipment", version: 1 },
  ),
);

export const pickEquippedItems = (
  inventory: Equipment[],
  equipped: Record<SlotKey, string | null>,
): Equipment[] =>
  SLOT_KEYS.map((slot) => {
    const id = equipped[slot];
    return id ? inventory.find((item) => item.id === id) : undefined;
  }).filter((item): item is Equipment => Boolean(item));
