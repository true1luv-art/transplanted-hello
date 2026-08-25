import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn("surface-card relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold sm:text-[1.75rem]">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="rounded-lg border border-border bg-surface-raised p-2 text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="pointer-events-none absolute -right-10 -bottom-14 size-32 rounded-full bg-primary/10 blur-2xl" />
    </div>
  );
}
