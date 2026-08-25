import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { CHEST_ODDS, CHESTS, RARITY_KEYS, RARITY_META } from "@/features/constants/game";
import { formatHash } from "@/lib/format";
import { iconByName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ChestKey } from "@/features/types/game";

const chestAccent: Record<ChestKey, string> = {
  common: "text-rarity-common bg-rarity-common/15",
  uncommon: "text-rarity-uncommon bg-rarity-uncommon/15",
  rare: "text-rarity-rare bg-rarity-rare/15",
  epic: "text-rarity-epic bg-rarity-epic/15",
  legendary: "text-rarity-legendary bg-rarity-legendary/15",
};

interface ChestCardProps {
  chest: ChestKey;
  wallet: number;
  busy?: boolean | undefined;
  onOpen: (chest: ChestKey) => void;
}

export function ChestCard({ chest, wallet, busy, onOpen }: ChestCardProps) {
  const config = CHESTS[chest];
  const odds = CHEST_ODDS[chest];
  const affordable = wallet >= config.price;
  const Icon = iconByName(config.icon);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className="card-soft flex flex-col gap-4 p-5"
    >
      <div className="flex items-start gap-3">
        <span className={cn("grid size-12 place-items-center rounded-xl", chestAccent[chest])}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{config.label}</h3>
          <p className="text-xs text-muted-foreground">{config.blurb}</p>
        </div>
      </div>

      <ul className="space-y-1 text-[11px]">
        {RARITY_KEYS.filter((rarity) => odds[rarity] > 0).map((rarity) => (
          <li key={rarity} className="flex items-center justify-between gap-2">
            <span className={RARITY_META[rarity].textClass}>{RARITY_META[rarity].label}</span>
            <span className="tabular-nums text-muted-foreground">{odds[rarity]}%</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="uppercase tracking-wider text-muted-foreground">Price</span>
          <span className="font-mono text-sm font-semibold text-primary tabular-nums">
            {formatHash(config.price, 0)} HASH
          </span>
        </div>
        <Button
          className="w-full"
          variant={affordable ? "default" : "secondary"}
          disabled={!affordable || busy}
          onClick={() => onOpen(chest)}
        >
          {affordable
            ? `Open — ${formatHash(config.price, 0)} HASH`
            : `Need ${formatHash(config.price - wallet, 0)} more HASH`}
        </Button>
      </div>
    </motion.div>
  );
}
