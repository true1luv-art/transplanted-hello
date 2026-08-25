import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { ActivityFeed } from "@/components/ActivityFeed";
import { FilterPills } from "@/components/MarketplaceFilters";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import { hive, num } from "@/lib/format";
import { useAppStore } from "@/features/stores/app-store";

const FILTERS = ["All", "Minted", "Listed", "Sold", "Transferred", "Collection Created"] as const;
const SCOPES = ["All activity", "My collections"] as const;

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — HiveX NFTs" },
      {
        name: "description",
        content: "Live feed of mints, listings, sales and transfers across HiveX NFTs.",
      },
      { property: "og:title", content: "Activity — HiveX NFTs" },
      {
        property: "og:description",
        content: "Every mint, listing, sale and transfer on HiveX NFTs.",
      },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const activities = useAppStore((s) => s.activities);
  const collections = useAppStore((s) => s.collections);
  const user = useAppStore((s) => s.user);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("All activity");

  // Activity for the collections the signed-in creator launched.
  const myCollectionIds = useMemo(
    () =>
      new Set(
        collections.filter((c) => user && c.creator === user.username).map((c) => c.id),
      ),
    [collections, user],
  );

  const scoped = useMemo(
    () =>
      scope === "My collections"
        ? activities.filter((a) => a.collectionId && myCollectionIds.has(a.collectionId))
        : activities,
    [activities, scope, myCollectionIds],
  );

  const rows = useMemo(
    () => (filter === "All" ? scoped : scoped.filter((a) => a.type === filter)),
    [scoped, filter],
  );

  const sales = scoped.filter((a) => a.type === "Sold");
  const salesVolume = sales.reduce((s, a) => s + (a.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Activity</h1>
        <p className="mt-2 text-muted-foreground">Everything happening across HiveX NFTs.</p>
      </header>

      <div className="flex items-center gap-6 border-b border-border">
        {SCOPES.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setScope(tab)}
            className={cn(
              "-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors",
              tab === scope
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Events" value={num(scoped.length)} />
        <StatCard label="Sales" value={num(sales.length)} />
        <StatCard label="Sales volume" value={hive(salesVolume)} />
      </div>

      <FilterPills options={FILTERS} value={filter} onChange={setFilter} />

      <div className="surface-card min-w-0 px-5 py-2">
        <ActivityFeed activities={rows} limit={60} />
      </div>
    </div>
  );
}
