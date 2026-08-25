import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  GeneratedNFT,
  GeneratorLayer,
  TraitDistributionRow,
} from "@/features/lib/generator/types";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Right-hand replacement panel: every trait available for the layer being
 * edited on the selected item. Picking one recomposites that item only.
 */
export function TraitPicker({
  nft,
  layer,
  distribution,
  onPick,
}: {
  nft: GeneratedNFT | null;
  layer: GeneratorLayer | null;
  distribution: TraitDistributionRow[];
  onPick: (tokenId: number, layerId: string, traitId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const rowByTrait = useMemo(
    () => new Map(distribution.map((row) => [row.traitId, row])),
    [distribution],
  );

  if (!nft || !layer) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Pick a property on the left to swap its trait for this item.
      </div>
    );
  }

  const currentTraitId = nft.traits.find((ref) => ref.layerId === layer.id)?.traitId ?? null;
  const query = search.trim().toLowerCase();
  const traits = layer.traits.filter(
    (trait) => trait.enabled && (!query || trait.name.toLowerCase().includes(query)),
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
            {layer.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">Replace on {nft.name}</p>
        </div>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={`Search ${layer.name.toLowerCase()} traits…`}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {traits.map((trait) => {
            const row = rowByTrait.get(trait.id);
            return (
              <button
                key={trait.id}
                type="button"
                onClick={() => onPick(nft.tokenId, layer.id, trait.id)}
                className={cn(
                  "overflow-hidden rounded-lg border bg-surface-raised p-1 text-left",
                  trait.id === currentTraitId
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className="relative aspect-square">
                  <img
                    src={trait.src}
                    alt={trait.name}
                    loading="lazy"
                    className="absolute inset-0 size-full object-contain"
                  />
                </div>
                <p className="truncate pt-1 text-[11px]">{trait.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {row ? `${row.count} · ${pct(row.actual)}` : "0 · 0.0%"}
                </p>
              </button>
            );
          })}
        </div>
        {traits.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No traits match “{search}”.
          </p>
        )}
      </div>
    </div>
  );
}
