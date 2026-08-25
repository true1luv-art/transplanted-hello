import { useMemo } from "react";

import { calculateTraitFrequencies, type TraitLayerConfig } from "@/features/lib/traits";
import type { NFT } from "@/features/types/domain/nfts";
import { cn } from "@/lib/utils";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Trait-frequency display: for every layer, how often each value actually
 * appears in the minted inventory vs. its configured probability.
 */
export function RarityChart({
  layers,
  nfts,
  className,
}: {
  layers: TraitLayerConfig[];
  nfts: NFT[];
  className?: string;
}) {
  const groups = useMemo(() => {
    const rows = calculateTraitFrequencies(
      layers,
      nfts.map((n) => ({ traits: n.traits ?? [] })),
    );
    const map = new Map<string, { layerName: string; rows: typeof rows }>();
    for (const row of rows) {
      const group = map.get(row.layerId) ?? { layerName: row.layerName, rows: [] };
      group.rows.push(row);
      map.set(row.layerId, group);
    }
    for (const group of map.values())
      group.rows.sort((a, b) => b.actualFrequency - a.actualFrequency);
    return [...map.values()];
  }, [layers, nfts]);

  if (groups.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>No trait layers configured.</p>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <p className="text-xs text-muted-foreground">
        Observed across {nfts.length} minted {nfts.length === 1 ? "item" : "items"} — dashed marker
        is the configured probability.
      </p>
      {groups.map((group) => (
        <section key={group.layerName} className="space-y-2">
          <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {group.layerName}
          </h3>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <li key={row.traitValueId} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{row.traitValueName}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.count} · {pct(row.actualFrequency)}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.min(100, row.actualFrequency * 100)}%` }}
                  />
                  <span
                    className="absolute top-0 h-full w-px bg-foreground/50"
                    style={{ left: `${Math.min(100, row.configuredProbability * 100)}%` }}
                    title={`Configured ${pct(row.configuredProbability)}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
