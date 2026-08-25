import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { CollectionCard } from "@/components/CollectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { useAppStore } from "@/features/stores/app-store";

const FILTERS = ["All", "Minting", "Sold Out", "Upcoming"] as const;
const SORTS = ["Trending", "Newest", "Floor price", "Volume"] as const;

export const Route = createFileRoute("/collections/")({
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } => {
    const raw = search["q"];
    return typeof raw === "string" && raw.trim() ? { q: raw } : {};
  },
  head: () => ({
    meta: [
      { title: "Collections — HiveX NFTs" },
      {
        name: "description",
        content:
          "Browse every NFT collection launched on HiveX NFTs: floor prices, supply, and mint progress.",
      },
      { property: "og:title", content: "Collections — HiveX NFTs" },
      { property: "og:description", content: "Browse NFT collections launched on Hive." },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const collections = useAppStore((s) => s.collections);
  const { q: initialQuery } = Route.useSearch();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Trending");
  const [query, setQuery] = useState(initialQuery ?? "");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = collections.filter(
      (c) =>
        (filter === "All" || c.status === filter) &&
        (!q || c.name.toLowerCase().includes(q) || c.creator.toLowerCase().includes(q)),
    );
    list = [...list].sort((a, b) => {
      if (sort === "Newest") return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sort === "Floor price") return a.floorPrice - b.floorPrice;
      if (sort === "Volume") return b.volume - a.volume;
      return b.trendingScore - a.trendingScore;
    });
    return list;
  }, [collections, filter, sort, query]);

  const totalMinted = visible.reduce((s, c) => s + c.minted, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Collections</h1>
        <p className="mt-2 text-muted-foreground">
          {collections.length} collections launched on HiveX NFTs.
        </p>
      </header>

      {/* Tab strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex items-center gap-6">
          {FILTERS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                "-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors",
                tab === filter
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search collections"
            className="w-full pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
          aria-label="Sort collections"
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary/50"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} collections · {num(totalMinted)} items minted
      </p>

      {visible.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {visible.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No collections found"
          description="Try a different filter or search term."
        />
      )}
    </div>
  );
}
