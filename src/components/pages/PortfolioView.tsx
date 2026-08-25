/**
 * Public account portfolio page.
 *
 * Same layout for everyone; action buttons (listing) render only for the
 * account owner — visitors get a read-only view.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { ListingModal } from "@/components/ListingModal";
import { NFTCard } from "@/components/NFTCard";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hive, num } from "@/lib/format";
import { hiveAvatarUrl } from "@/lib/chain/identity";
import type { NFT } from "@/features/types/domain/nfts";
import { useAppStore } from "@/features/stores/app-store";
import { useHiveProfile } from "@/hooks/useHiveProfile";

const FILTERS = ["All", "Owned", "Listed"] as const;
const SORTS = ["Newest", "Value: high to low", "Name"] as const;

export function PortfolioView({ username: raw }: { username: string }) {
  const { username, profile, isOwner } = useHiveProfile(raw);
  const nfts = useAppStore((s) => s.nfts);
  const listings = useAppStore((s) => s.listings);
  const balance = useAppStore((s) => s.balances[username] ?? (s.user?.username === username ? s.hiveBalance : 0));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Newest");
  const [query, setQuery] = useState("");
  const [listTarget, setListTarget] = useState<NFT | null>(null);

  const owned = useMemo(() => nfts.filter((n) => n.owner === username), [nfts, username]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = owned.filter(
      (n) =>
        (filter === "All" || n.status === filter) &&
        (!q || n.name.toLowerCase().includes(q) || n.collectionName.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) => {
      if (sort === "Value: high to low") return b.estimatedValue - a.estimatedValue;
      if (sort === "Name") return a.name.localeCompare(b.name);
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
  }, [owned, filter, sort, query]);

  const value = owned.reduce((s, n) => s + n.estimatedValue, 0);
  const listedCount = owned.filter((n) => n.status === "Listed").length;

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
          { label: "NFTs owned", value: num(owned.length) },
          { label: "Estimated value", value: hive(value) },
          { label: "Listed", value: num(listedCount) },
          { label: "HIVE balance", value: hive(balance) },
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
        {!isOwner ? (
          <span className="mb-2 rounded border border-border px-2 py-0.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            View only
          </span>
        ) : null}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isOwner ? "Search your NFTs" : `Search @${username}'s NFTs`}
            className="w-full pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])}
          aria-label="Sort items"
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
        {rows.length} items · {listedCount} listed for sale
      </p>

      {rows.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7">
          {rows.map((n) => (
            <NFTCard
              key={n.id}
              nft={n}
              listing={listings.find((l) => l.nftId === n.id)}
              action={
                isOwner && n.status !== "Listed"
                  ? { label: "List for sale", onClick: () => setListTarget(n), variant: "outline" }
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing here yet"
          description={
            isOwner
              ? "Mint an NFT from a collection to start your portfolio."
              : `@${username} doesn't own any NFTs yet.`
          }
          action={
            <Button asChild>
              <Link to="/collections">Browse collections</Link>
            </Button>
          }
        />
      )}

      {isOwner && listTarget ? (
        <ListingModal
          nft={listTarget}
          open={Boolean(listTarget)}
          onOpenChange={(v) => !v && setListTarget(null)}
        />
      ) : null}
    </div>
  );
}
