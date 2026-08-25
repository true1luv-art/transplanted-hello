import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import type { GeneratorLayer, TraitDistributionRow } from "@/features/lib/generator/types";

export function PropertyFilter({
  layers,
  distribution,
  filters,
  onToggle,
  onClear,
}: {
  layers: GeneratorLayer[];
  distribution: TraitDistributionRow[];
  filters: Record<string, string[]>;
  onToggle: (layerId: string, traitId: string) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(layers.map((l) => l.id)));
  const active = Object.values(filters).reduce((sum, ids) => sum + ids.length, 0);
  const ordered = [...layers].sort((a, b) => a.order - b.order);

  const toggleLayer = (layerId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
          Filter by property
        </h2>
        {active > 0 && (
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={onClear}>
            Clear ({active})
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {ordered.map((layer) => {
          const rows = distribution.filter((row) => row.layerId === layer.id);
          if (rows.length === 0) return null;
          const isOpen = expanded.has(layer.id);
          const selectedInLayer = (filters[layer.id] ?? []).length;
          return (
            <div key={layer.id} className="rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => toggleLayer(layer.id)}
                className="flex w-full items-center justify-between px-2 py-2 text-left"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {layer.name}
                  {selectedInLayer > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                      {selectedInLayer}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="space-y-1 px-2 pb-2">
                  {rows.map((row) => {
                    const checked = (filters[layer.id] ?? []).includes(row.traitId);
                    return (
                      <label
                        key={row.traitId}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggle(layer.id, row.traitId)}
                        />
                        <span className="min-w-0 flex-1 truncate">{row.traitName}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.count} ({(row.actual * 100).toFixed(1)}%)
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
