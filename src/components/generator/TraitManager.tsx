import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizedProbabilities } from "@/features/lib/traits/weighted-random";
import type { GeneratorLayer, GeneratorTrait } from "@/features/lib/generator/types";

const prettyName = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export function TraitManager({
  layer,
  onAddTraits,
  onUpdateTrait,
  onRemoveTrait,
}: {
  layer: GeneratorLayer | null;
  onAddTraits: (layerId: string, traits: { filename: string; name: string; src: string }[]) => void;
  onUpdateTrait: (layerId: string, traitId: string, patch: Partial<GeneratorTrait>) => void;
  onRemoveTrait: (layerId: string, traitId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!layer) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
        Select or create a layer to manage its traits.
      </div>
    );
  }

  const probabilities = normalizedProbabilities(layer.traits);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        filename: file.name,
        name: prettyName(file.name),
        src: URL.createObjectURL(file),
      }));
    if (added.length > 0) onAddTraits(layer.id, added);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{layer.name}</h2>
          <p className="text-xs text-muted-foreground">
            {layer.traits.length} trait{layer.traits.length === 1 ? "" : "s"} in this layer
          </p>
        </div>
        <Button className="ml-auto" onClick={() => inputRef.current?.click()}>
          <ImagePlus className="mr-2 size-4" /> Upload traits
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg,image/svg+xml"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      <Tabs defaultValue="traits" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="traits">Traits</TabsTrigger>
          <TabsTrigger value="rarity">Weights</TabsTrigger>
        </TabsList>

        <TabsContent value="traits" className="min-h-0 flex-1 overflow-y-auto pt-4">
          {layer.traits.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-foreground"
            >
              <ImagePlus className="size-6" />
              Upload PNG trait images for {layer.name}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {layer.traits.map((trait) => (
                <div
                  key={trait.id}
                  className="space-y-2 rounded-xl border border-border bg-surface p-2"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-raised">
                    <img
                      src={trait.src}
                      alt={trait.name}
                      className="absolute inset-0 size-full object-contain"
                    />
                  </div>
                  <Input
                    value={trait.name}
                    className="h-8 text-xs"
                    onChange={(event) =>
                      onUpdateTrait(layer.id, trait.id, { name: event.target.value })
                    }
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {((probabilities.get(trait.id) ?? 0) * 100).toFixed(1)}%
                    </span>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={trait.enabled}
                        aria-label={`Enable ${trait.name}`}
                        onCheckedChange={(enabled) =>
                          onUpdateTrait(layer.id, trait.id, { enabled })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive"
                        aria-label={`Remove ${trait.name}`}
                        onClick={() => onRemoveTrait(layer.id, trait.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rarity" className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
          {layer.traits.length === 0 && (
            <p className="text-sm text-muted-foreground">Upload traits to tune their weights.</p>
          )}
          {layer.traits.map((trait) => (
            <div key={trait.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <img
                  src={trait.src}
                  alt=""
                  className="size-10 rounded-md bg-surface-raised object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{trait.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {((probabilities.get(trait.id) ?? 0) * 100).toFixed(1)}% of this layer
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{trait.weight}</span>
              </div>
              <div className="mt-3 space-y-1">
                <Slider
                  value={[trait.weight]}
                  min={0}
                  max={100}
                  step={1}
                  aria-label={`${trait.name} weight`}
                  onValueChange={([weight]) =>
                    onUpdateTrait(layer.id, trait.id, { weight: weight ?? 0 })
                  }
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>0 (never)</span>
                  <span>100 (most likely)</span>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
