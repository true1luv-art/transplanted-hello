import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ActivityFeed } from "@/components/ActivityFeed";
import { EmptyState } from "@/components/EmptyState";
import { FilterPills } from "@/components/MarketplaceFilters";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { hive, num } from "@/lib/format";
import { useAppStore } from "@/features/stores/app-store";

const FILTERS = ["All", "Minted", "Listed", "Sold", "Transferred"] as const;

export const Route = createFileRoute("/collections/$id/activity")({
  head: () => ({
    meta: [
      { title: "Collection sales — HiveX NFTs" },
      {
        name: "description",
        content: "Every mint, listing, sale and transfer for this HiveX NFTs collection.",
      },
      { property: "og:title", content: "Collection sales — HiveX NFTs" },
      {
        property: "og:description",
        content: "Full on-chain activity history for this collection.",
      },
    ],
  }),
  component: CollectionActivityPage,
});

function CollectionActivityPage() {
  const { id } = Route.useParams();
  const collection = useAppStore((s) => s.collections.find((c) => c.id === id));
  const activities = useAppStore((s) => s.activities);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const all = useMemo(() => activities.filter((a) => a.collectionId === id), [activities, id]);
  const rows = useMemo(
    () => (filter === "All" ? all : all.filter((a) => a.type === filter)),
    [all, filter],
  );

  const sales = all.filter((a) => a.type === "Sold");
  const salesVolume = sales.reduce((s, a) => s + (a.amount ?? 0), 0);

  if (!collection) {
    return (
      <EmptyState
        title="Collection not found"
        description="This collection may have been removed."
        action={
          <Button asChild variant="outline">
            <Link to="/collections">Back to collections</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2 text-muted-foreground">
          <Link to="/collections/$id" params={{ id }}>
            <ArrowLeft className="size-4" />
            {collection.name}
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Collection sales</h1>
        <p className="text-muted-foreground">Everything that happened in {collection.name}.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Events" value={num(all.length)} />
        <StatCard label="Sales" value={num(sales.length)} />
        <StatCard label="Sales volume" value={hive(salesVolume)} />
      </div>

      <FilterPills options={FILTERS} value={filter} onChange={setFilter} />

      <div className="surface-card min-w-0 px-5 py-2">
        <ActivityFeed activities={rows} limit={100} />
      </div>
    </div>
  );
}
