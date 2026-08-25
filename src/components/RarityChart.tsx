import { useMemo } from "react";
import { Loader2 } from "lucide-react";

import { normalizedProbabilities, type TraitLayerConfig } from "@/features/lib/traits";
import type { NFTAttribute } from "@/features/lib/metadata";
import { cn } from "@/lib/utils";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Trait-frequency display: for every layer, how often each value actually
 * appears in the minted inventory vs. its configured probability.
 */
export function RarityChart({
  layers,
  mintedAttributes,
  loading = false,
  failedCount = 0,
  className,
}: {
  layers: TraitLayerConfig[];
  mintedAttributes: NFTAttribute[][];
  loading?: boolean;
  failedCount?: number;
  className?: string;
}) {
  const groups = useMemo(() => {
    const normalized = (value: string | number) => String(value).trim().toLocaleLowerCase();
    const configuredLayers = new Map(
      layers.map((layer) => [normalized(layer.name), layer] as const),
    );
    const counts = new Map<string, Map<string, { name: string; count: number }>>();

    for (const attributes of mintedAttributes) {
      for (const attribute of attributes) {
        const layerKey = normalized(attribute.trait_type);
        const valueKey = normalized(attribute.value);
        const values = counts.get(layerKey) ?? new Map();
        const current = values.get(valueKey);
        values.set(valueKey, {
          name: String(attribute.value),
          count: (current?.count ?? 0) + 1,
        });
        counts.set(layerKey, values);
      }
    }

    const layerKeys = new Set([...configuredLayers.keys(), ...counts.keys()]);
    const built = [...layerKeys].map((layerKey) => {
      const layer = configuredLayers.get(layerKey);
      const observed = counts.get(layerKey) ?? new Map();
      const probabilities = layer ? normalizedProbabilities(layer.values) : new Map<string, number>();
      const configuredValues = new Map(
        (layer?.values ?? []).map((value) => [normalized(value.name), value] as const),
      );
      const valueKeys = new Set([...configuredValues.keys(), ...observed.keys()]);
      const rows = [...valueKeys]
        .map((valueKey) => {
          const configured = configuredValues.get(valueKey);
          const actual = observed.get(valueKey);
          return {
            id: configured?.id ?? `${layerKey}:${valueKey}`,
            name: configured?.name ?? actual?.name ?? valueKey,
            count: actual?.count ?? 0,
            actualFrequency:
              mintedAttributes.length > 0 ? (actual?.count ?? 0) / mintedAttributes.length : 0,
            configuredProbability: configured ? (probabilities.get(configured.id) ?? 0) : 0,
          };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.actualFrequency - a.actualFrequency || a.name.localeCompare(b.name));
      return { id: layer?.id ?? layerKey, layerName: layer?.name ?? layerKey, rows };
    });
  }, [layers, mintedAttributes]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-6 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" />
        Reading minted NFT metadata from IPFS…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No traits were found in the minted NFTs' IPFS metadata.
      </p>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <p className="text-xs text-muted-foreground">
        Observed from the IPFS metadata of {mintedAttributes.length} minted{" "}
        {mintedAttributes.length === 1 ? "item" : "items"} — dashed marker is the configured
        probability.
      </p>
      {failedCount > 0 ? (
        <p className="text-xs text-destructive">
          {failedCount} minted {failedCount === 1 ? "item was" : "items were"} excluded because its
          metadata could not be read.
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group.layerName} className="space-y-2">
          <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {group.layerName}
          </h3>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <li key={row.id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{row.name}</span>
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
