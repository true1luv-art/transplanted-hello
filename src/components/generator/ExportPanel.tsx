import { useState } from "react";
import { ArrowRight, CheckCircle2, Download, Package } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { downloadExportFile } from "@/features/lib/generator/export";
import type { ExportFile } from "@/features/lib/generator/types";

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function FileRow({
  file,
  badge,
  label,
  sub,
  done,
  onDownload,
}: {
  file: ExportFile;
  badge: string;
  label: string;
  sub: string;
  done: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-xs font-semibold text-muted-foreground">
        {badge}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {file.filename} · {sub} · {kb(file.bytes.byteLength)}
        </p>
      </div>
      {done ? <CheckCircle2 className="size-4 text-primary" /> : null}
      <Button
        variant={done ? "outline" : "default"}
        size="sm"
        onClick={() => {
          downloadExportFile(file);
          onDownload();
        }}
      >
        <Download className="mr-2 size-4" /> Download
      </Button>
    </div>
  );
}

export function ExportPanel({
  collection,
  batches,
  bundle,
  onReset,
}: {
  collection: ExportFile;
  batches: ExportFile[];
  bundle: ExportFile;
  onReset?: () => void;
}) {
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});
  const total = 1 + batches.length;
  const count = [collection, ...batches].filter((file) => downloaded[file.filename]).length;
  const mark = (name: string) => setDownloaded((prev) => ({ ...prev, [name]: true }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-primary" />
        <h2 className="pt-3 font-display text-xl font-semibold">The collection is ready</h2>
        <p className="mx-auto max-w-md pt-2 text-sm text-muted-foreground">
          Everything is built right in your browser — no traits are uploaded anywhere. For better
          performance the collection is divided into batches of 100 items each.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Downloaded: {count}/{total}
      </p>

      <div className="space-y-3">
        <FileRow
          file={collection}
          badge="M"
          label="Metadata"
          sub="Collection metadata"
          done={!!downloaded[collection.filename]}
          onDownload={() => mark(collection.filename)}
        />
        {batches.map((batch, index) => (
          <FileRow
            key={batch.filename}
            file={batch}
            badge={String(index + 1)}
            label={`Items ${index * 100 + 1}-${index * 100 + batch.count}`}
            sub={`${batch.count} NFTs`}
            done={!!downloaded[batch.filename]}
            onDownload={() => mark(batch.filename)}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={() => downloadExportFile(bundle)}>
          <Package className="mr-2 size-4" /> Download everything in one archive (
          {kb(bundle.bytes.byteLength)})
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/creator/collections/new">
            Import these archives into a collection <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
        {onReset ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Create a new collection
          </Button>
        ) : null}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        These archives are import-ready: upload <code>metadata.zip</code> plus the batch archives in
        Create Collection.
      </p>
    </div>
  );
}
