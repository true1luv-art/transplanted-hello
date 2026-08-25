import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="rounded-full border border-border bg-surface-raised p-3 text-muted-foreground">
        <PackageOpen className="size-5" />
      </span>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}
