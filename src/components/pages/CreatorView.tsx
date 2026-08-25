/**
 * Public creator page for any Hive account.
 *
 * Owner sees the create/manage actions; visitors get the same layout read-only.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { CollectionCard } from "@/components/CollectionCard";
import { EmptyState } from "@/components/EmptyState";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hive, num } from "@/lib/format";
import { hiveAvatarUrl } from "@/lib/chain/identity";
import { useAppStore } from "@/features/stores/app-store";
import { useHiveProfile } from "@/hooks/useHiveProfile";

const FILTERS = ["All", "Minting", "Sold Out", "Upcoming"] as const;
const SORTS = ["Newest", "Volume: high to low", "Items minted", "Name"] as const;

export function CreatorView({ username: raw }: { username: string }) {
  const { username, profile, isOwner } = useHiveProfile(raw);
  const collections = useAppStore((s) => s.collections);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Newest");
  const [query, setQuery] = useState("");

  const mine = useMemo(
    () => collections.filter((c) => c.creator === username),
    [collections, username],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = mine.filter(
      (c) => (filter === "All" || c.status === filter) && (!q || c.name.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) => {
      if (sort === "Volume: high to low") return b.volume - a.volume;
      if (sort === "Items minted") return b.minted - a.minted;
      if (sort === "Name") return a.name.localeCompare(b.name);
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
  }, [mine, filter, sort, query]);

  const minted = mine.reduce((s, c) => s + c.minted, 0);
  const revenue = mine.reduce((s, c) => s + c.minted * c.mintPrice * (c.creatorFee / 100), 0);
  const holders = mine.reduce((s, c) => s + c.holders, 0);

  const header = profile ?? {
    username,
    displayName: username,
    avatarUrl: hiveAvatarUrl(username),
  };

  return (
    <div className="space-y-4">
      <ProfileHeader
        user={header}
        stats={[
          { label: "Collections", value: num(mine.length) },
          { label: "Items minted", value: num(minted) },
          { label: "Creator revenue", value: hive(revenue, 0) },
          { label: "Holders", value: num(holders) },
        ]}
      />

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
        {isOwner ? (
          <Button asChild size="sm" className="mb-2 gap-2">
            <Link to="/creator/collections/new">
              <Plus className="size-4" /> Create Collection
            </Link>
          </Button>
        ) : (
          <span className="mb-2 rounded border border-border px-2 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            View only
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isOwner ? "Search your collections" : `Search @${username}'s collections`}
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
        {rows.length} collections · {num(minted)} items minted
      </p>

      {rows.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {rows.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No collections yet"
          description={
            isOwner
              ? "Launch your first NFT collection on Hive."
              : `@${username} hasn't launched a collection yet.`
          }
          action={
            isOwner ? (
              <Button asChild>
                <Link to="/creator/collections/new">Create Collection</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
