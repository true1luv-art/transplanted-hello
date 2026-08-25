import { CheckCircle2, FileArchive, XCircle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { num } from "@/lib/format";
import type {
  BatchImportResult,
  CollectionMetadataImport,
  ImportProgress,
} from "@/features/lib/import/zip-batch";

interface Props {
  collection: CollectionMetadataImport | null;
  batches: BatchImportResult[];
  progress?: ImportProgress | null;
}

/** Per-archive import progress and validation results. */
export function BatchImportPanel({ collection, batches, progress }: Props) {
  return (
    <div className="space-y-4">
      {progress && progress.phase !== "done" && (
        <div className="space-y-2">
          <Progress value={progress.percent} />
          <p className="text-xs text-muted-foreground">
            {progress.phase === "analysing"
              ? "Calculating traits and rarity across the collection…"
              : `Importing ${progress.zipName} (${progress.index}/${progress.total})`}
          </p>
        </div>
      )}

      {collection && (
        <div className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <FileArchive className="mt-0.5 size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{collection.zipName}</p>
            <p className="text-xs text-muted-foreground">
              Collection metadata · {collection.sourceFile ?? "not found"}
              {collection.name ? ` · ${collection.name}` : ""}
            </p>
          </div>
          <Status ok={collection.valid} />
        </div>
      )}

      {batches.map((batch) => (
        <div key={batch.zipName} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <FileArchive className="size-4 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{batch.batchName}</p>
            <Status ok={batch.valid} />
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
            <Cell label="Images" value={num(batch.imageCount)} />
            <Cell label="Metadata" value={num(batch.metadataCount)} />
            <Cell label="Matched" value={num(batch.matchedCount)} />
            <Cell
              label="Missing"
              value={num(batch.missingImages.length)}
              bad={batch.missingImages.length > 0}
            />
            <Cell
              label="Orphans"
              value={num(batch.orphanImages.length)}
              bad={batch.orphanImages.length > 0}
            />
            <Cell
              label="Dup IDs"
              value={num(batch.duplicateTokenIds.length)}
              bad={batch.duplicateTokenIds.length > 0}
            />
          </dl>
          {batch.missingImages.length > 0 && (
            <p className="text-xs text-destructive">
              Missing: {batch.missingImages.slice(0, 4).join(", ")}
              {batch.missingImages.length > 4
                ? ` +${num(batch.missingImages.length - 4)} more`
                : ""}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Status({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 text-xs text-success">
      <CheckCircle2 className="size-3.5" /> Valid
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <XCircle className="size-3.5" /> Invalid
    </span>
  );
}

function Cell({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bad ? "font-medium text-destructive" : "font-medium"}>{value}</dd>
    </div>
  );
}
