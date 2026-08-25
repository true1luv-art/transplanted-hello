import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { num } from "@/lib/format";
import type { ImportReport } from "@/features/lib/import/types";

/** Errors block the import; warnings are informational only. */
export function ValidationReport({ report }: { report: ImportReport }) {
  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {report.ready ? (
          <CheckCircle2 className="size-5 text-success" />
        ) : (
          <XCircle className="size-5 text-destructive" />
        )}
        <p className="text-sm font-medium">
          {report.ready
            ? `${num(report.statistics.totalNfts)} NFTs validated and ready to import`
            : `${num(errors.length)} problem${errors.length === 1 ? "" : "s"} must be fixed before importing`}
        </p>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {errors.map((issue, i) => (
            <li key={i}>
              <span className="font-mono">{issue.code}</span> · {issue.message}
              {issue.count ? ` (+${num(issue.count)} more)` : ""}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
          {warnings.map((issue, i) => (
            <li key={i} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {issue.message}
                {issue.count ? ` (+${num(issue.count)} more)` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
