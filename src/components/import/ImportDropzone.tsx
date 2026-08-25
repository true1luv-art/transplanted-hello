import { useRef } from "react";
import { FolderOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint: string;
  accept: string;
  files: File[];
  disabled?: boolean;
  onPick: (files: File[]) => void;
  onClear: () => void;
  className?: string;
}

/**
 * Bulk file picker for imported collection packages. Optimised for thousands
 * of files: it never creates previews, it only counts and samples names.
 */
export function ImportDropzone({
  label,
  hint,
  accept,
  files,
  disabled,
  onPick,
  onClear,
  className,
}: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {files.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          onPick(Array.from(e.dataTransfer.files));
        }}
        className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center transition-colors hover:border-primary/60 disabled:opacity-60"
      >
        <FolderOpen className="size-5 text-muted-foreground" />
        <span className="text-sm">
          {files.length ? `${num(files.length)} files selected` : "Drop files or click to browse"}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>

      {files.length > 0 && (
        <p className="truncate text-xs text-muted-foreground">
          {files
            .slice(0, 4)
            .map((f) => f.name)
            .join(", ")}
          {files.length > 4 ? ` +${num(files.length - 4)} more` : ""}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
