import { motion } from "framer-motion";
import { Flame, Hammer, MoreHorizontal, Star, Tag } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RARITY_META, SLOT_META, STAT_KEYS, STAT_META } from "@/features/constants/game";
import { equipmentScore } from "@/features/game/stats";
import { rarityStyles, slotIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Equipment } from "@/features/types/game";

interface EquipmentCardProps {
  item: Equipment;
  onEquip?: ((item: Equipment) => void) | undefined;
  onUnequip?: ((item: Equipment) => void) | undefined;
  onUpgrade?: ((item: Equipment) => void) | undefined;
  onSalvage?: ((item: Equipment) => void) | undefined;
  onSell?: ((item: Equipment) => void) | undefined;
  compact?: boolean | undefined;
  /** Hides every action (used for the chest reveal). */
  hideActions?: boolean | undefined;
  /** Replaces the default equip/sell actions (used by the marketplace). */
  footer?: ReactNode;
}

export function EquipmentCard({
  item,
  onEquip,
  onUnequip,
  onUpgrade,
  onSalvage,
  onSell,
  compact,
  hideActions,
  footer,
}: EquipmentCardProps) {
  const rarity = rarityStyles(item.rarity);
  const SlotIcon = slotIcon(item.slot);
  const score = Math.round(equipmentScore(item) * 10) / 10;
  const rolled = STAT_KEYS.filter((key) => (item.stats[key] ?? 0) > 0);
  const [busy, setBusy] = useState(false);

  // Equip/unequip hit the server, so keep a spinner up until the call
  // resolves — the handlers may return a promise or nothing.
  const runEquipAction = async (action?: (item: Equipment) => void) => {
    if (!action || busy) return;
    setBusy(true);
    try {
      await Promise.resolve(action(item));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={cn(
        "card-soft flex flex-col gap-3 p-4 ring-1 ring-inset",
        rarity.ringClass,
        item.equipped && "outline outline-1 outline-primary/60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl",
            rarity.bgClass,
            rarity.textClass,
          )}
        >
          <SlotIcon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold">{item.name}</h3>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-warning"
              title={`Level ${item.level}`}
            >
              <Star className="size-3 fill-current" />
              {item.level}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{SLOT_META[item.slot].label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("border-current/30 text-[10px]", rarity.textClass)}
            >
              {RARITY_META[item.rarity].label}
            </Badge>

            {item.equipped ? (
              <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">
                Equipped
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right" title="Power score = SPARKS value if salvaged">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Power</p>
          <p className="text-lg font-semibold tabular-nums text-primary">{score}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">sparks</p>
        </div>
      </div>

      {!compact ? (
        <ul className="grid grid-cols-2 gap-1.5 text-xs">
          {rolled.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-2 py-1"
            >
              <span className="truncate text-muted-foreground">{STAT_META[key].label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-success">
                +{Math.round((item.stats[key] ?? 0) * 100) / 100}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {hideActions
        ? null
        : (footer ?? (
            <div className="mt-auto flex gap-2">
              {item.equipped ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  loading={busy}
                  onClick={() => void runEquipAction(onUnequip)}
                >
                  {busy ? "Unequipping…" : "Unequip"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="flex-1"
                  loading={busy}
                  onClick={() => void runEquipAction(onEquip)}
                >
                  {busy ? "Equipping…" : "Equip"}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onSelect={() => onSell?.(item)}
                    disabled={!onSell || item.equipped}
                    title={item.equipped ? "Unequip before selling" : undefined}
                  >
                    <Tag className="size-4" /> Sell
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onUpgrade?.(item)} disabled={!onUpgrade}>
                    <Hammer className="size-4" /> Upgrade
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onSalvage?.(item)}
                    disabled={!onSalvage || item.equipped}
                    title={item.equipped ? "Unequip before salvaging" : undefined}
                    className="text-destructive focus:text-destructive"
                  >
                    <Flame className="size-4" /> Salvage
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
    </motion.article>
  );
}
