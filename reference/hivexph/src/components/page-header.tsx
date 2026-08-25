import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

export interface PageHeaderStat {
  label: string;
  value: string;
}

export interface PageHeaderProps {
  /** Lucide icon component (e.g. `Waves`). */
  icon: ComponentType<LucideProps>;
  /** Page title (e.g. "Diesel Pools"). */
  title: string;
  /** Short one-line description shown under the title. */
  description?: string;
  /** Optional stat tiles row. Renders nothing when omitted/empty. */
  stats?: PageHeaderStat[];
  /** Optional action slot (e.g. a primary button or link). */
  action?: ReactNode;
}

function StatTile({ label, value }: PageHeaderStat) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4">
      <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate font-display text-lg font-bold text-foreground md:text-xl">
        {value}
      </p>
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  stats,
  action,
}: PageHeaderProps) {
  const hasStats = Array.isArray(stats) && stats.length > 0;
  // Choose a column count up to 4 based on the number of stats.
  const colsClass =
    stats?.length === 1
      ? "sm:grid-cols-1"
      : stats?.length === 2
        ? "sm:grid-cols-2"
        : stats?.length === 3
          ? "sm:grid-cols-3"
          : "sm:grid-cols-4";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {hasStats && (
        <div className={`grid grid-cols-2 gap-3 ${colsClass}`}>
          {stats!.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}
