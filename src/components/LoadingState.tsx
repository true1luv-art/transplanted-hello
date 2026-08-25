import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-16 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card animate-pulse overflow-hidden">
          <div className="aspect-square bg-surface-raised" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/2 rounded bg-surface-raised" />
            <div className="h-3 w-2/3 rounded bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}
