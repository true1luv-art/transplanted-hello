import { useState } from "react";

import { EquipmentCard } from "@/components/game/EquipmentCard";
import { EquipmentSlot } from "@/components/game/EquipmentSlot";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SLOT_KEYS, SLOT_META } from "@/features/constants/game";
import { equipmentScore } from "@/features/game/stats";
import { useEquipmentStore } from "@/features/stores/equipmentStore";
import { useEquipActions } from "@/hooks/useEquipActions";
import type { Equipment, SlotKey } from "@/features/types/game";

export function RigSlotsSection() {
  const inventory = useEquipmentStore((state) => state.inventory);
  const equippedMap = useEquipmentStore((state) => state.equipped);
  const { equipItem, unequipItem } = useEquipActions();
  const [openSlot, setOpenSlot] = useState<SlotKey | null>(null);

  const handleEquip = (item: Equipment) => {
    void equipItem(item);
  };

  const handleUnequip = (item: Equipment) => {
    void unequipItem(item);
  };

  const slotItems = openSlot
    ? inventory
        .filter((item) => item.slot === openSlot)
        .sort((a, b) => equipmentScore(b) - equipmentScore(a))
    : [];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Mining rig</h2>
        <p className="text-xs text-muted-foreground">
          One item per slot. Click a slot to browse gear that fits it — equipped stats apply
          instantly.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SLOT_KEYS.map((slot) => {
          const id = equippedMap[slot];
          const item = id ? inventory.find((entry) => entry.id === id) : undefined;
          return <EquipmentSlot key={slot} slot={slot} item={item} onSelect={setOpenSlot} />;
        })}
      </div>

      <Sheet open={openSlot !== null} onOpenChange={(open) => !open && setOpenSlot(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{openSlot ? SLOT_META[openSlot].label : "Slot"}</SheetTitle>
            <SheetDescription>
              {slotItems.length} item{slotItems.length === 1 ? "" : "s"} available for this slot.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {slotItems.length === 0 ? (
              <div className="card-soft grid place-items-center p-8 text-center text-sm text-muted-foreground">
                No gear for this slot yet. Open a chest to find some.
              </div>
            ) : (
              slotItems.map((item) => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  onEquip={(entry) => {
                    handleEquip(entry);
                    setOpenSlot(null);
                  }}
                  onUnequip={handleUnequip}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
