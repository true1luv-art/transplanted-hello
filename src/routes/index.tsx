import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { FeaturedStrip } from "@/components/home/FeaturedStrip";
import { TopCollectionsTable } from "@/components/home/TopCollectionsTable";
import { NFTCard } from "@/components/NFTCard";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/features/stores/app-store";

const TABS = ["Trending", "Top volume", "New"] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HiveX NFTs — Hive NFT Launchpad & Marketplace" },
      {
        name: "description",
        content:
          "Launch NFT collections, mint with HIVE and trade on the native Hive marketplace. Track volume, listings and creator earnings in one dashboard.",
      },
      { property: "og:title", content: "HiveX NFTs — Hive NFT Launchpad & Marketplace" },
      {
        property: "og:description",
        content: "Create collections. Mint NFTs. Trade on Hive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const collections = useAppStore((s) => s.collections);
  const nfts = useAppStore((s) => s.nfts);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Trending");

  const featured = useMemo(
    () => [...collections].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 6),
    [collections],
  );

  const ranked = useMemo(() => {
    const list = [...collections];
    if (tab === "Top volume") list.sort((a, b) => b.volume - a.volume);
    else if (tab === "New") list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    else list.sort((a, b) => b.trendingScore - a.trendingScore);
    return list.slice(0, 8);
  }, [collections, tab]);

  const recentMints = useMemo(
    () =>
      [...nfts]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 6),
    [nfts],
  );

  return (
    <div className="space-y-8">
      <section aria-label="Featured collections">
        <FeaturedStrip collections={featured} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="flex items-center gap-6">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors",
                  t === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Link
            to="/collections"
            className="pb-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            See all
          </Link>
        </div>
        <TopCollectionsTable collections={ranked} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h2 className="font-display text-base font-semibold">Recent mints</h2>
          <Link to="/collections" className="text-sm text-muted-foreground hover:text-foreground">
            Browse collections
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {recentMints.map((n) => (
            <NFTCard key={n.id} nft={n} />
          ))}
        </div>
      </section>
    </div>
  );
}
