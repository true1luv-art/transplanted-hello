import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BATCH_SIZE } from "@/features/lib/generator/batching";
import { itemNameFor } from "@/features/lib/generator/naming";
import {
  MAX_COLLECTION_SIZE,
  MAX_DIMENSION,
  MIN_DIMENSION,
  FIRST_ITEM_NUMBER,
  type GeneratorSettings,
} from "@/features/lib/generator/types";

/** Output artwork is always square-bounded between 512px and 2048px. */
const clampDimension = (value: number): number =>
  !Number.isFinite(value)
    ? MIN_DIMENSION
    : Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));

export function CollectionSettings({
  settings,
  combinations,
  onChange,
}: {
  settings: GeneratorSettings;
  combinations: number;
  onChange: (patch: Partial<GeneratorSettings>) => void;
}) {
  const supply = Number.isFinite(settings.supply) ? Math.max(1, Math.floor(settings.supply)) : 1;
  const batchCount = Math.ceil(supply / BATCH_SIZE);
  const firstName = itemNameFor(settings, FIRST_ITEM_NUMBER);
  const lastName = itemNameFor(settings, FIRST_ITEM_NUMBER + supply - 1);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
        Collection settings
      </h2>

      <div className="space-y-2">
        <Label htmlFor="gen-name">Name</Label>
        <Input
          id="gen-name"
          value={settings.name}
          placeholder="Otters Outbreak"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gen-prefix">Item name prefix</Label>
        <Input
          id="gen-prefix"
          value={settings.itemPrefix}
          placeholder={settings.name || "Otters #"}
          onChange={(event) => onChange({ itemPrefix: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          &ldquo;Otters&rdquo; → Otters 1 · &ldquo;Otters #&rdquo; → Otters #1
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gen-description">Description</Label>
        <Textarea
          id="gen-description"
          rows={3}
          value={settings.description}
          placeholder="What makes this collection worth minting?"
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="gen-width">Width (px)</Label>
          <Input
            id="gen-width"
            type="number"
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            step={1}
            value={settings.width}
            onChange={(event) => onChange({ width: Number(event.target.value) })}
            onBlur={(event) => onChange({ width: clampDimension(Number(event.target.value)) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gen-height">Height (px)</Label>
          <Input
            id="gen-height"
            type="number"
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            step={1}
            value={settings.height}
            onChange={(event) => onChange({ height: Number(event.target.value) })}
            onBlur={(event) => onChange({ height: clampDimension(Number(event.target.value)) })}
          />
        </div>
      </div>

      <p className="-mt-2 text-xs text-muted-foreground">
        Exported PNGs are rendered at this exact size. Minimum {MIN_DIMENSION}px, maximum{" "}
        {MAX_DIMENSION}px.
      </p>

      <div className="space-y-2">
        <Label htmlFor="gen-size">Collection size</Label>
        <Input
          id="gen-size"
          type="number"
          min={1}
          max={MAX_COLLECTION_SIZE}
          value={settings.supply}
          onChange={(event) => onChange({ supply: Number(event.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Number of NFTs to generate. Token IDs always start at 1 and exports are split into ZIP
          batches of {BATCH_SIZE}
          {batchCount > 0 ? ` (${batchCount} batch${batchCount === 1 ? "" : "es"})` : ""}.
        </p>
      </div>

      <div className="space-y-1 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
        <p>
          Naming preview: <span className="font-semibold text-foreground">{firstName}</span> …{" "}
          <span className="font-semibold text-foreground">{lastName}</span>
        </p>
        <p>
          Possible unique combinations:{" "}
          <span className="font-semibold text-foreground">{combinations.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}
