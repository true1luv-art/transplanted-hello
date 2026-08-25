import { useState } from "react";

import { ChestCard } from "@/components/game/ChestCard";
import { ChestModal } from "@/components/game/ChestModal";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CHEST_KEYS,
  CHEST_ODDS,
  PURCHASABLE_CHEST_KEYS,
  CHESTS,
  RARITY_KEYS,
  RARITY_META,
} from "@/features/constants/game";
import { openChest as openChestLocal } from "@/features/game/chest";
import { itemDtoToEquipment } from "@/features/game/item-mapper";
import { useGameStats } from "@/hooks/useGameStats";
import { formatHash } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api/client";
import { isDemoSession } from "@/features/stores/authStore";
import { useChestStore } from "@/features/stores/chestStore";
import { useEquipmentStore } from "@/features/stores/equipmentStore";
import { usePlayerStore } from "@/features/stores/playerStore";
import type { ChestKey, Equipment } from "@/features/types/game";

export function ChestsPage() {
  const { wallet, total } = useGameStats();
  const spend = usePlayerStore((state) => state.spendSink);
  const syncFromApi = usePlayerStore((state) => state.syncFromApi);
  const addItem = useEquipmentStore((state) => state.addItem);
  const equip = useEquipmentStore((state) => state.equip);
  const recordOpen = useChestStore((state) => state.recordOpen);

  const [activeChest, setActiveChest] = useState<ChestKey | null>(null);
  const [reward, setReward] = useState<Equipment | null>(null);

  const handleOpen = async (chest: ChestKey) => {
    const price = CHESTS[chest].price;

    // Demo play never talks to the server — keep the pure client-side
    // simulation exactly as before.
    if (isDemoSession()) {
      if (!spend(price)) {
        notify("Not enough HASH for that chest", "danger");
        return;
      }
      recordOpen(chest, price);
      setActiveChest(chest);
      setReward(null);

      window.setTimeout(() => {
        const item = openChestLocal(chest, total.luck);
        addItem(item);
        setReward(item);
        notify(`Opened a chest and found ${item.name}`, "loot", [
          { text: "Opened a chest and found " },
          { text: item.name, className: RARITY_META[item.rarity].textClass },
        ]);
      }, 1100);
      return;
    }

    // Real wallet session: minting an item is a server-authoritative action.
    // The server debits HASH, rolls the drop, and inserts the item row in
    // the DB in one request — the client never fabricates an item locally,
    // it only ever displays/caches what the server actually created.
    if (wallet < price) {
      notify("Not enough HASH for that chest", "danger");
      return;
    }
    setActiveChest(chest);
    setReward(null);

    const seed = crypto.randomUUID();
    const [result] = await Promise.all([
      api.openChest(chest, seed),
      new Promise((resolve) => setTimeout(resolve, 1100)), // keep the crack-open animation readable
    ]);

    await syncFromApi(); // refresh HASH balance debited server-side

    if (!result.ok || !result.item) {
      notify(result.error ?? "Chest failed to open — try again", "danger");
      setActiveChest(null);
      return;
    }

    const item = itemDtoToEquipment(result.item);
    recordOpen(chest, price);
    addItem(item);
    setReward(item);
    notify(`Opened a chest and found ${item.name}`, "loot", [
      { text: "Opened a chest and found " },
      { text: item.name, className: RARITY_META[item.rarity].textClass },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chests"
        description="Every chest rolls a random slot, rarity, stat set and stat values. Luck nudges the odds upward."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PURCHASABLE_CHEST_KEYS.map((chest) => (
          <ChestCard
            key={chest}
            chest={chest}
            wallet={wallet}
            busy={activeChest !== null && reward === null}
            onOpen={handleOpen}
          />
        ))}
      </div>

      <ChestModal
        open={activeChest !== null}
        chest={activeChest}
        reward={reward}
        onClose={() => {
          setActiveChest(null);
          setReward(null);
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Odds by tier</h2>
        <div className="card-soft overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Chest</th>
                {RARITY_KEYS.map((rarity) => (
                  <th key={rarity} className="px-4 py-3 text-right font-medium">
                    <span className={RARITY_META[rarity].textClass}>
                      {RARITY_META[rarity].label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHEST_KEYS.map((chest) => (
                <tr key={chest} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {CHESTS[chest].label}
                    {!PURCHASABLE_CHEST_KEYS.includes(chest) ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        Coming soon
                      </span>
                    ) : null}
                  </td>
                  {RARITY_KEYS.map((rarity) => {
                    const odds = CHEST_ODDS[chest][rarity];
                    return (
                      <td
                        key={rarity}
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          odds > 0 ? "text-foreground" : "text-muted-foreground/40",
                        )}
                      >
                        {odds > 0 ? `${odds}%` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Luck nudges every roll toward higher rarities — the odds above are the base rates at 0
          Luck.
        </p>
      </section>
    </div>
  );
}
