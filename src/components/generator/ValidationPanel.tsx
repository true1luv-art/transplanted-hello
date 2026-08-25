import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import type { GenerationValidationError } from "@/features/lib/generator/types";

export function ValidationPanel({
  issues,
  okLabel = "All checks passed",
}: {
  issues: GenerationValidationError[];
  okLabel?: string;
}) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
        <CheckCircle2 className="size-4 text-emerald-500" />
        {okLabel}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => (
        <li
          key={`${issue.code}-${issue.subject ?? index}`}
          className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-sm"
        >
          {issue.severity === "error" ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
