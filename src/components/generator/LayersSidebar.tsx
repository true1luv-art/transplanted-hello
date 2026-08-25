import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Layers, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GeneratorLayer } from "@/features/lib/generator/types";

/** Stacks the first enabled trait of every layer — a cheap live composite. */
function LayersPreview({ layers }: { layers: GeneratorLayer[] }) {
  const stack = [...layers]
    .filter((layer) => layer.enabled)
    .sort((a, b) => a.order - b.order)
    .map((layer) => layer.traits.find((trait) => trait.enabled && trait.src))
    .filter((trait): trait is NonNullable<typeof trait> => Boolean(trait));

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface-raised">
      {stack.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No traits yet
        </div>
      ) : (
        stack.map((trait) => (
          <img
            key={trait.id}
            src={trait.src}
            alt={trait.name}
            className="absolute inset-0 size-full object-contain"
          />
        ))
      )}
    </div>
  );
}

export function LayersSidebar({
  layers,
  activeLayerId,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  onToggle,
  onMove,
}: {
  layers: GeneratorLayer[];
  activeLayerId: string | null;
  onSelect: (layerId: string) => void;
  onAdd: (name: string) => void;
  onRename: (layerId: string, name: string) => void;
  onRemove: (layerId: string) => void;
  onToggle: (layerId: string, enabled: boolean) => void;
  onMove: (layerId: string, direction: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState("");
  const ordered = [...layers].sort((a, b) => b.order - a.order);

  const submit = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Layers</h2>
        <span className="ml-auto text-xs text-muted-foreground">{layers.length}</span>
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="New layer name"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        <Button size="icon" variant="outline" onClick={submit} aria-label="Add layer">
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {ordered.map((layer, index) => (
          <div
            key={layer.id}
            className={cn(
              "rounded-xl border p-2 transition-colors",
              layer.id === activeLayerId
                ? "border-primary bg-primary/5"
                : "border-border bg-surface",
            )}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(layer.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{layer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {layer.traits.length} trait{layer.traits.length === 1 ? "" : "s"}
                </p>
              </button>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${layer.name} up`}
                  disabled={index === 0}
                  onClick={() => onMove(layer.id, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${layer.name} down`}
                  disabled={index === ordered.length - 1}
                  onClick={() => onMove(layer.id, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
            </div>

            {layer.id === activeLayerId && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={layer.name}
                  onChange={(event) => onRename(layer.id, event.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={layer.enabled ? "Hide layer" : "Show layer"}
                  onClick={() => onToggle(layer.id, !layer.enabled)}
                >
                  {layer.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-destructive"
                  aria-label={`Delete ${layer.name}`}
                  onClick={() => onRemove(layer.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {layers.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Add a layer to begin. The top layer renders in front.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Layers preview
        </p>
        <LayersPreview layers={layers} />
      </div>
    </div>
  );
}
