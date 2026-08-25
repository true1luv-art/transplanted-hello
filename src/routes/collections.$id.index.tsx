import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, LineChart, Search } from "lucide-react";

import { CollectionHeader } from "@/components/CollectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { MintModal } from "@/components/MintModal";
import { NFTCard } from "@/components/NFTCard";
import { RarityChart } from "@/components/RarityChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/features/stores/app-store";
import { loadIpfsNftAttributes } from "@/features/lib/storage/ipfs-metadata";
import type { NFTAttribute } from "@/features/types/domain/nfts";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["All items", "For sale", "Not listed"] as const;
const SORTS = ["Price: Low to High", "Price: High to Low", "Mint number"] as const;

export const Route = createFileRoute("/collections/$id/")({
  head: () => ({
    meta: [
      { title: "Collection — HiveX NFTs" },
      { name: "description", content: "Collection details, rarity breakdown and minted items." },
      { property: "og:title", content: "Collection — HiveX NFTs" },
      { property: "og:description", content: "Mint and explore a Hive NFT collection." },
    ],
  }),
  component: CollectionDetail,
});

function CollectionDetail() {
  const { id } = Route.useParams();
  const collection = useAppStore((s) => s.collections.find((c) => c.id === id));
  const nfts = useAppStore((s) => s.nfts);
  const listings = useAppStore((s) => s.listings);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All items");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Price: Low to High");
  const [query, setQuery] = useState("");
  const [mintOpen, setMintOpen] = useState(false);
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [mintedAttributes, setMintedAttributes] = useState<NFTAttribute[][]>([]);
  const [traitsLoading, setTraitsLoading] = useState(false);
  const [traitsFailed, setTraitsFailed] = useState(0);

  const priceOf = (nftId: string) => listings.find((l) => l.nftId === nftId)?.price;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = nfts.filter((n) => {
      if (n.collectionId !== id) return false;
      const listed = listings.some((l) => l.nftId === n.id);
      if (status === "For sale" && !listed) return false;
      if (status === "Not listed" && listed) return false;
      if (q && !n.name.toLowerCase().includes(q) && !String(n.mintNumber).includes(q)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "Mint number") return a.mintNumber - b.mintNumber;
      const pa = priceOf(a.id);
      const pb = priceOf(b.id);
      if (pa === undefined && pb === undefined) return a.mintNumber - b.mintNumber;
      if (pa === undefined) return 1;
      if (pb === undefined) return -1;
      return sort === "Price: Low to High" ? pa - pb : pb - pa;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfts, id, status, listings, sort, query]);

  const allItems = useMemo(() => nfts.filter((n) => n.collectionId === id), [nfts, id]);

  useEffect(() => {
    if (!traitsOpen) return;
    const controller = new AbortController();
    setTraitsLoading(true);
    setTraitsFailed(0);

    void Promise.allSettled(
      allItems.map((nft) => {
        const metadataUri = nft.properties?.metadata || nft.metadataUri;
        if (!metadataUri) return Promise.reject(new Error("Minted NFT has no metadata URI"));
        return loadIpfsNftAttributes(metadataUri, controller.signal);
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const loaded: NFTAttribute[][] = [];
      let failed = 0;
      for (const result of results) {
        if (result.status === "fulfilled") loaded.push(result.value);
        else failed += 1;
      }
      setMintedAttributes(loaded);
      setTraitsFailed(failed);
      setTraitsLoading(false);
    });

    return () => controller.abort();
  }, [allItems, traitsOpen]);

  const forSaleCount = useMemo(
    () =>
      nfts.filter((n) => n.collectionId === id && listings.some((l) => l.nftId === n.id)).length,
    [nfts, listings, id],
  );

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
    <div className="space-y-4">
      <CollectionHeader
        collection={collection}
        onMint={() => setMintOpen(true)}
        listedCount={forSaleCount}
      />

      {/* Tab strip + collection tools (Magic Eden style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex items-center gap-6">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatus(tab)}
              className={cn(
                "-mb-px border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors",
                tab === status
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setTraitsOpen(true)}>
            <BarChart3 className="size-4" />
            Trait distribution
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/collections/$id/activity" params={{ id }}>
              <LineChart className="size-4" />
              Collection sales
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
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
        {items.length} items · {forSaleCount} listed for sale
      </p>

      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7">
          {items.map((n) => (
            <NFTCard key={n.id} nft={n} listing={listings.find((l) => l.nftId === n.id)} />
          ))}
        </div>
      ) : (
        <EmptyState title="No items yet" description="Be the first to mint from this collection." />
      )}

      <Dialog open={traitsOpen} onOpenChange={setTraitsOpen}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="font-display">Trait distribution</DialogTitle>
            <DialogDescription>How often each trait appears across minted items.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
            <RarityChart
              layers={collection.traitLayers ?? []}
              mintedAttributes={mintedAttributes}
              loading={traitsLoading}
              failedCount={traitsFailed}
            />
          </div>
        </DialogContent>
      </Dialog>

      <MintModal collection={collection} open={mintOpen} onOpenChange={setMintOpen} />
    </div>
  );
}
