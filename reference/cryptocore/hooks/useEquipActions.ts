import * as api from "@/lib/api/client";
import { isDemoSession } from "@/features/stores/authStore";
import { useEquipmentStore } from "@/features/stores/equipmentStore";
import { notify } from "@/lib/notify";
import type { Equipment, SlotKey } from "@/features/types/game";

/**
 * Equip/unequip is server-authoritative for real wallet sessions — the
 * player document's `equipment.<slot>` field is the source of truth, not
 * the local equipmentStore. Demo play never talks to the server and keeps
 * the pure client-side simulation.
 *
 * This is shared by every equip/unequip entry point (InventoryPage,
 * RigSlotsSection, ...) so a real session always persists to the DB — a
 * component that only calls the local store update would show gear as
 * equipped in the UI while the player document never records it.
 */
export function useEquipActions() {
  const equip = useEquipmentStore((state) => state.equip);
  const unequip = useEquipmentStore((state) => state.unequip);

  const equipItem = async (item: Equipment) => {
    if (isDemoSession()) {
      equip(item.id);
      notify(`${item.name} equipped`, "success");
      return;
    }

    const result = await api.equipItem(Number(item.id));
    if (!result.ok) {
      notify(result.error ?? "Could not equip this item", "danger");
      return;
    }
    // Mirror the server's change locally instead of refetching the whole
    // inventory — equip() already handles unequipping any prior item in
    // the same slot on the client side, matching what the server just did.
    equip(item.id);
    notify(`${item.name} equipped`, "success");
  };

  const unequipItem = async (item: Equipment) => {
    if (isDemoSession()) {
      unequip(item.slot);
      notify("Equipment unequipped", "info");
      return;
    }

    const result = await api.unequipItem(Number(item.id));
    if (!result.ok) {
      notify(result.error ?? "Could not unequip this item", "danger");
      return;
    }
    unequip(item.slot as SlotKey);
    notify("Equipment unequipped", "info");
  };

  return { equipItem, unequipItem };
}
