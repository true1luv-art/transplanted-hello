import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { GeneratedNFT, TraitDistributionRow } from "@/features/lib/generator/types";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Selected item: large composite, editable name, and one row per property.
 * Clicking a property opens that layer in the replacement panel on the right.
 */
export function ItemDetails({
  nft,
  distribution,
  editLayerId,
  onRename,
  onEditLayer,
}: {
  nft: GeneratedNFT | null;
  distribution: TraitDistributionRow[];
  editLayerId: string | null;
  onRename: (tokenId: number, name: string) => void;
  onEditLayer: (layerId: string | null) => void;
}) {
  const rowByTrait = useMemo(
    () => new Map(distribution.map((row) => [row.traitId, row])),
    [distribution],
  );

  if (!nft) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        Select an item to edit it.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Item details</h2>

      <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-raised">
        {nft.previewUrl && (
          <img
            src={nft.previewUrl}
            alt={nft.name}
            className="absolute inset-0 size-full object-contain"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          value={nft.name}
          onChange={(event) => onRename(nft.tokenId, event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Token #{nft.tokenId}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Properties
        </p>
        {nft.traits.map((ref) => {
          const row = rowByTrait.get(ref.traitId);
          const active = ref.layerId === editLayerId;
          return (
            <button
              key={ref.layerId}
              type="button"
              onClick={() => onEditLayer(active ? null : ref.layerId)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border bg-surface p-3 text-left transition-colors",
                active
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {ref.layerName}
                </p>
                <p className="truncate text-sm font-medium">{ref.traitName}</p>
                <p className="pt-0.5 text-[11px] text-muted-foreground">
                  {row
                    ? `${row.count} item${row.count === 1 ? "" : "s"} (${pct(row.actual)}) · weight ${ref.weight}`
                    : `Weight ${ref.weight}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-primary">{active ? "Editing" : "Change"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
