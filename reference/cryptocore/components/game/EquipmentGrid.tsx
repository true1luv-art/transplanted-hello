import { AnimatePresence } from "framer-motion";
import { PackageSearch, PackageX, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EquipmentCard } from "@/components/game/EquipmentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RARITY_KEYS, RARITY_META, SLOT_KEYS, SLOT_META } from "@/features/constants/game";
import { equipmentScore } from "@/features/game/stats";
import type { Equipment } from "@/features/types/game";

type SortKey = "score" | "newest" | "rarity" | "name";

interface EquipmentGridProps {
  items: Equipment[];
  onEquip?: ((item: Equipment) => void) | undefined;
  onUnequip?: ((item: Equipment) => void) | undefined;
  onUpgrade?: ((item: Equipment) => void) | undefined;
  onSalvage?: ((item: Equipment) => void) | undefined;
  onSell?: ((item: Equipment) => void) | undefined;
  emptyMessage?: string | undefined;
}

export function EquipmentGrid({
  items,
  onEquip,
  onUnequip,
  onUpgrade,
  onSalvage,
  onSell,
  emptyMessage,
}: EquipmentGridProps) {
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState<string>("all");
  const [rarity, setRarity] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("score");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (slot !== "all" && item.slot !== slot) return false;
      if (rarity !== "all" && item.rarity !== rarity) return false;
      if (query && !item.name.toLowerCase().includes(query)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      // Equipped gear always leads the grid, no matter which sort mode is
      // active, so players see what they're using without scrolling.
      if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;

      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rarity") {
        return RARITY_KEYS.indexOf(b.rarity) - RARITY_KEYS.indexOf(a.rarity);
      }
      return equipmentScore(b) - equipmentScore(a);
    });
  }, [items, search, slot, rarity, sort]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gear"
            className="pl-9"
            aria-label="Search equipment"
          />
        </div>

        <Select value={slot} onValueChange={setSlot}>
          <SelectTrigger aria-label="Filter by slot">
            <SelectValue placeholder="All slots" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All slots</SelectItem>
            {SLOT_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {SLOT_META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rarity} onValueChange={setRarity}>
          <SelectTrigger aria-label="Filter by rarity">
            <SelectValue placeholder="All rarities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rarities</SelectItem>
            {RARITY_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {RARITY_META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger aria-label="Sort inventory">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Power score</SelectItem>
            <SelectItem value="rarity">Rarity</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="card-soft flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
          {items.length === 0 ? (
            <>
              <span className="grid size-14 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground">
                <PackageX className="size-7" />
              </span>
              <p className="max-w-xs">
                {emptyMessage ??
                  "Your inventory is empty. Open a chest to find your first rig part."}
              </p>
              <Button asChild size="sm">
                <Link href="/chests">Open a chest</Link>
              </Button>
            </>
          ) : (
            <>
              <span className="grid size-14 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground">
                <PackageSearch className="size-7" />
              </span>
              <p className="max-w-xs">No gear matches these filters.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSlot("all");
                  setRarity("all");
                }}
              >
                Clear filters
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                onEquip={onEquip}
                onUnequip={onUnequip}
                onUpgrade={onUpgrade}
                onSalvage={onSalvage}
                onSell={onSell}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
