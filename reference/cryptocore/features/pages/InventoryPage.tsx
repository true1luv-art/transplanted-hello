import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { EquipmentGrid } from "@/components/game/EquipmentGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { RARITY_META, SLOT_META, STAT_KEYS, STAT_META } from "@/features/constants/game";
import { MARKET_FEE, suggestedPrice } from "@/features/stores/marketplaceStore";
import {
  SALVAGE_MULTIPLIERS,
  salvageValue,
  upgradeCost,
  upgradedStats,
  UPGRADE_MULTIPLIER,
} from "@/features/game/items";
import { equipmentScore } from "@/features/game/stats";
import { formatHash } from "@/lib/format";
import { slotIcon } from "@/lib/icons";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api/client";
import { useEquipmentStore } from "@/features/stores/equipmentStore";
import { usePlayerStore } from "@/features/stores/playerStore";
import { useAuthStore, isDemoSession } from "@/features/stores/authStore";
import { useEquipActions } from "@/hooks/useEquipActions";
import type { Equipment } from "@/features/types/game";

const round3 = (value: number) => Math.round(value * 1000) / 1000;

type Pending = { kind: "salvage" | "upgrade" | "sell"; item: Equipment } | null;

/** Item identity header used at the top of the upgrade / sell dialogs. */
function ItemSummary({ item }: { item: Equipment }) {
  const rarity = RARITY_META[item.rarity];
  const Icon = slotIcon(item.slot);
  return (
    <div className="flex gap-3 border-b border-border pb-4">
      <span
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-xl",
          rarity.bgClass,
          rarity.textClass,
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {item.name}
          <span className={cn("text-[10px] uppercase", rarity.textClass)}>{rarity.label}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {SLOT_META[item.slot].label} · Level {item.level}
        </p>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const inventory = useEquipmentStore((state) => state.inventory);
  const removeItem = useEquipmentStore((state) => state.removeItem);
  const upgradeItem = useEquipmentStore((state) => state.upgradeItem);
  const { equipItem: equipViaApi, unequipItem: unequipViaApi } = useEquipActions();

  const sparks = usePlayerStore((state) => state.sparks);
  const creditSparks = usePlayerStore((state) => state.creditSparks);
  const spendSparks = usePlayerStore((state) => state.spendSparks);
  const syncFromApi = usePlayerStore((state) => state.syncFromApi);

  const mode = useAuthStore((state) => state.mode);
  /** Demo accounts play locally, so there is no real market to sell into. */
  const canSell = mode === "wallet";

  const [pending, setPending] = useState<Pending>(null);
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const item = pending?.item ?? null;

  useEffect(() => {
    if (pending?.kind === "sell") setPrice(String(suggestedPrice(pending.item)));
  }, [pending]);

  const handleEquip = (entry: Equipment) => equipViaApi(entry);

  const handleUnequip = (entry: Equipment) => unequipViaApi(entry);

  const cost = item ? upgradeCost(item) : 0;
  const affordable = sparks >= cost;
  const listPrice = Number(price);
  // Whole HASH only — decimal listing prices would make the marketplace fee
  // split unpredictable, so require an integer here too.
  const priceValid = Number.isInteger(listPrice) && listPrice > 0;
  const net = priceValid ? listPrice * (1 - MARKET_FEE) : 0;

  // Strip decimal points/commas as the user types so the price is always an
  // integer.
  const handlePriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrice(event.target.value.replace(/[^\d]/g, ""));
  };

  const confirm = async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    try {
      await runConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  const runConfirm = async () => {
    if (!pending) return;
    const { kind, item: target } = pending;

    if (kind === "salvage") {
      // Demo play never talks to the server — keep the pure client-side
      // simulation exactly as before.
      if (isDemoSession()) {
        const value = salvageValue(target);
        removeItem(target.id);
        creditSparks(value);
        notify(`Salvaged ${target.name} for ${formatHash(value, 3)} SPARKS`, "success");
        setPending(null);
        return;
      }

      // Real wallet session: salvaging is server-authoritative. The server
      // destroys the item and credits SPARKS in one request — the client
      // never fabricates the payout locally, it only reflects what the
      // server actually did (via syncFromApi below).
      const result = await api.salvageItem(Number(target.id));
      if (!result.ok) {
        notify(result.error ?? "Could not salvage this item", "danger");
        setPending(null);
        return;
      }
      removeItem(target.id);
      await syncFromApi();
      notify(
        `Salvaged ${target.name} for ${formatHash(salvageValue(target), 3)} SPARKS`,
        "success",
      );
    }

    if (kind === "upgrade") {
      if (isDemoSession()) {
        if (!spendSparks(upgradeCost(target))) {
          notify("Not enough SPARKS to upgrade this item", "danger");
          setPending(null);
          return;
        }
        upgradeItem(target.id);
        notify(`${target.name} upgraded to level ${target.level + 1}`, "success");
        setPending(null);
        return;
      }

      const result = await api.upgradeItem(Number(target.id));
      if (!result.ok) {
        notify(result.error ?? "Could not upgrade this item", "danger");
        setPending(null);
        return;
      }
      // The server debited SPARKS and scaled the item's stats with the
      // exact same formula (upgradedStats) — mirror it locally rather than
      // refetching the whole inventory for one item.
      upgradeItem(target.id);
      await syncFromApi();
      notify(`${target.name} upgraded to level ${target.level + 1}`, "success");
    }

    if (kind === "sell") {
      if (!priceValid) return;

      // Selling is server-authoritative: the item is listed on the real
      // marketplace (visible to every player on the Marketplace page), not
      // just simulated in a local store. Equipped or already-listed items
      // are rejected server-side.
      const result = await api.listMarketItem("item", Number(target.id), listPrice);
      if (!result.ok) {
        notify(result.error ?? "Could not list this item for sale", "danger");
        setPending(null);
        return;
      }
      removeItem(target.id);
      notify(
        `${target.name} listed for ${formatHash(listPrice)} HASH on the marketplace`,
        "success",
      );
    }

    setPending(null);
  };

  const nextStats = item ? upgradedStats(item.stats) : null;

  const equippedCount = inventory.filter((entry) => entry.equipped).length;
  const totalPowerScore = inventory.reduce((sum, entry) => sum + equipmentScore(entry), 0);
  const totalSalvageValue = inventory.reduce((sum, entry) => sum + salvageValue(entry), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Every rig part you own. Equip gear, upgrade it with SPARKS, or salvage it back into SPARKS."
      />

      {inventory.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Items owned", value: String(inventory.length) },
            { label: "Equipped", value: `${equippedCount} / ${inventory.length}` },
            { label: "Power score", value: formatHash(totalPowerScore, 0) },
            { label: "Salvage value", value: `${formatHash(totalSalvageValue, 0)} SPARKS` },
          ].map((stat) => (
            <div key={stat.label} className="card-soft p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Gear ({inventory.length})</h2>
        <EquipmentGrid
          items={inventory}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onUpgrade={(entry) => setPending({ kind: "upgrade", item: entry })}
          onSalvage={(entry) => setPending({ kind: "salvage", item: entry })}
          onSell={canSell ? (entry) => setPending({ kind: "sell", item: entry }) : undefined}
          emptyMessage="Your inventory is empty. Open a chest to find your first rig part."
        />
      </section>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => (open ? null : setPending(null))}
      >
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          {item && pending ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending.kind === "salvage"
                    ? "Salvage Item"
                    : pending.kind === "upgrade"
                      ? "Upgrade Item"
                      : "List For Sale"}
                </AlertDialogTitle>
                <AlertDialogDescription className="sr-only">
                  {pending.kind} {item.name}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <ItemSummary item={item} />

              {pending.kind === "upgrade" && nextStats ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Upgrade this item for{" "}
                    <span className="font-semibold text-success">
                      ~{formatHash(cost, 3)} SPARKS
                    </span>
                    . The item stats will improve based on the following table.
                  </p>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="bg-secondary/40">
                          <td className="px-3 py-2 font-medium">Your SPARKS</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatHash(sparks, 3)}
                          </td>
                          <td className="w-8 px-1 py-2 text-center text-destructive">→</td>
                          <td className="px-3 py-2 text-right tabular-nums text-destructive">
                            -{formatHash(cost, 3)}
                          </td>
                        </tr>
                        <tr className="border-t border-border/60">
                          <td className="px-3 py-2 font-medium">Level</td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.level}</td>
                          <td className="px-1 py-2 text-center text-success">→</td>
                          <td className="px-3 py-2 text-right tabular-nums text-success">
                            {item.level + 1}
                          </td>
                        </tr>
                        {STAT_KEYS.filter((key) => (item.stats[key] ?? 0) > 0).map((key) => (
                          <tr key={key} className="border-t border-border/60 bg-secondary/20">
                            <td className="px-3 py-2 font-medium">{STAT_META[key].label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {round3(item.stats[key] ?? 0)}
                            </td>
                            <td className="px-1 py-2 text-center text-success">→</td>
                            <td className="px-3 py-2 text-right tabular-nums text-success">
                              {round3(nextStats[key] ?? 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Every rolled stat gains {Math.round((UPGRADE_MULTIPLIER - 1) * 100)}% per level.
                  </p>
                </div>
              ) : null}

              {pending.kind === "salvage" ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Salvage this item for{" "}
                    <span className="font-semibold text-success">
                      {formatHash(salvageValue(item), 3)} SPARKS
                    </span>
                    . The item is destroyed in the process.
                  </p>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/60 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Stat</th>
                          <th className="px-3 py-2 text-right font-medium">Value</th>
                          <th className="px-3 py-2 text-right font-medium">Multiplier</th>
                          <th className="px-3 py-2 text-right font-medium">Sparks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {STAT_KEYS.map((key) => {
                          const value = item.stats[key] ?? 0;
                          const mult = SALVAGE_MULTIPLIERS[key];
                          return (
                            <tr key={key} className="border-t border-border/60">
                              <td className="px-3 py-1.5">{STAT_META[key].label}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {round3(value)}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                                x{mult}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-success">
                                {round3(value * mult)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {pending.kind === "sell" ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    List this item on the in-game marketplace. Other miners (or NPCs on refresh) can
                    buy it. When it sells, you receive the price minus a{" "}
                    {Math.round(MARKET_FEE * 100)}% marketplace fee.
                  </p>
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Price:</p>
                    <div className="flex overflow-hidden rounded-md border border-input">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={price}
                        onChange={handlePriceChange}
                        className="rounded-none border-0 focus-visible:ring-0"
                      />
                      <span className="grid shrink-0 place-items-center border-l border-input bg-secondary px-3 text-xs font-semibold">
                        HASH
                      </span>
                    </div>
                    <p className="mt-1.5 text-right text-xs text-muted-foreground">
                      Whole HASH only — no decimals. When sold you receive ~
                      <span className="font-semibold text-success">{formatHash(net)} HASH</span>{" "}
                      after fees · suggested {formatHash(suggestedPrice(item))}
                    </p>
                  </div>
                </div>
              ) : null}

              <AlertDialogFooter>
                <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    // Keep the dialog open while the server request is in
                    // flight so the spinner is visible; confirm() closes it.
                    event.preventDefault();
                    void confirm();
                  }}
                  disabled={
                    submitting ||
                    (pending.kind === "upgrade" && !affordable) ||
                    (pending.kind === "sell" && !priceValid)
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Working…
                    </>
                  ) : pending.kind === "upgrade" && !affordable ? (
                    "Not enough SPARKS"
                  ) : (
                    "Confirm"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
