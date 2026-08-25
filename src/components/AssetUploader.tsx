import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PickedFile {
  file: File;
  previewUrl: string;
}

interface Props {
  label: string;
  hint?: string;
  multiple?: boolean;
  accept: string;
  files: PickedFile[];
  onPick: (files: File[]) => void;
  onRemove?: (index: number) => void;
  disabled?: boolean;
}

/** Drag-and-drop / click file picker with thumbnail previews. */
export function AssetUploader({
  label,
  hint,
  multiple,
  accept,
  files,
  onPick,
  onRemove,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          onPick(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center transition-colors",
          disabled ? "opacity-60" : "hover:border-primary/50",
        )}
      >
        <ImagePlus className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose file{multiple ? "s" : ""}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => {
            onPick(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {files.slice(0, 18).map((f, i) => (
            <div
              key={`${f.file.name}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <img
                src={f.previewUrl}
                alt={f.file.name}
                className="aspect-square w-full object-cover"
              />
              {onRemove ? (
                <button
                  type="button"
                  aria-label={`Remove ${f.file.name}`}
                  onClick={() => onRemove(i)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
          {files.length > 18 ? (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">
              +{files.length - 18}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
