import { ArrowLeftRight, Flame, Sparkles, Store, Tag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ClientTime } from "@/components/ClientTime";
import { EmptyState } from "@/components/EmptyState";
import { hive } from "@/lib/format";
import type { Activity, ActivityType } from "@/features/types/domain/activity";
import { cn } from "@/lib/utils";

const icons: Record<ActivityType, typeof Flame> = {
  Minted: Sparkles,
  Listed: Tag,
  Sold: Store,
  Transferred: ArrowLeftRight,
  "Collection Created": Flame,
  Delisted: Tag,
};

const tone: Record<ActivityType, string> = {
  Minted: "text-primary border-primary/30 bg-primary/10",
  Listed: "text-accent border-accent/30 bg-accent/10",
  Sold: "text-success border-success/30 bg-success/10",
  Transferred: "text-muted-foreground border-border bg-surface-raised",
  "Collection Created": "text-accent-gold border-accent-gold/30 bg-accent-gold/10",
  Delisted: "text-muted-foreground border-border bg-surface-raised",
};

export function ActivityFeed({
  activities,
  limit,
  className,
}: {
  activities: Activity[];
  limit?: number;
  className?: string;
}) {
  const items = limit ? activities.slice(0, limit) : activities;
  if (!items.length)
    return <EmptyState title="No activity yet" description="Actions will appear here." />;

  return (
    <ul className={cn("min-w-0 divide-y divide-border", className)}>
      {items.map((a) => {
        const Icon = icons[a.type];
        return (
          <li
            key={a.id}
            className="flex min-w-0 items-center gap-3 overflow-hidden px-1 py-3.5 sm:gap-4"
          >
            <span className={cn("rounded-lg border p-2", tone[a.type])}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {a.nftId ? (
                  <Link to="/nfts/$id" params={{ id: a.nftId }} className="hover:text-primary">
                    {a.label}
                  </Link>
                ) : a.collectionId ? (
                  <Link
                    to="/collections/$id"
                    params={{ id: a.collectionId }}
                    className="hover:text-primary"
                  >
                    {a.label}
                  </Link>
                ) : (
                  a.label
                )}
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{a.type}</span>
                <span>·</span>
                <ClientTime iso={a.createdAt} />
                {a.txId ? (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden font-mono sm:inline">{a.txId}</span>
                  </>
                ) : null}
              </div>
            </div>
            {typeof a.amount === "number" && a.amount > 0 ? (
              <span className="shrink-0 font-display text-sm font-semibold">{hive(a.amount)}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
