import { useState } from "react";
import { BadgeCheck, ChevronDown, Crown, Flag, Star } from "lucide-react";

import { ClientDate } from "@/components/ClientTime";
import { IpfsImage } from "@/components/IpfsImage";
import { Button } from "@/components/ui/button";
import { hive, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Collection } from "@/features/types/domain/collections";

/**
 * Compact marketplace-style collection header: avatar + name on the left,
 * an inline stats strip on the right, and a collapsible "Info" panel.
 */
export function CollectionHeader({
  collection,
  onMint,
  listedCount,
}: {
  collection: Collection;
  onMint: () => void;
  listedCount: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const soldOut = collection.minted >= collection.maxSupply;
  const listedPct = collection.minted ? (listedCount / collection.minted) * 100 : 0;
  const ownersPct = collection.minted ? (collection.holders / collection.minted) * 100 : 0;

  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:gap-8">
        <div className="flex min-w-0 items-center gap-3">
          <IpfsImage
            src={collection.image}
            alt={`${collection.name} artwork`}
            className="size-12 shrink-0 rounded-full border border-border object-cover"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-display text-lg font-bold">{collection.name}</h1>
              <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" />
              <Star className="size-4 shrink-0 text-muted-foreground" />
              <Crown className="size-4 shrink-0 text-primary" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-expanded={infoOpen}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:border-border-strong"
              >
                Info
                <ChevronDown
                  className={cn("size-3.5 transition-transform", infoOpen && "rotate-180")}
                />
              </button>
              <span className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase">
                {collection.symbol}
              </span>
              <span
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] uppercase",
                  soldOut
                    ? "border border-border-strong bg-surface text-muted-foreground"
                    : "border border-success/30 bg-success/10 text-success",
                )}
              >
                {collection.status}
              </span>
            </div>
          </div>
        </div>

        <dl className="flex flex-1 flex-wrap items-center gap-x-7 gap-y-3">
          <Stat label="Floor Price" value={hive(collection.floorPrice)} accent />
          <Stat label="Mint Price" value={hive(collection.mintPrice)} accent />
          <Stat label="Volume" value={hive(collection.volume, 0)} />
          <Stat
            label="Listed / Supply"
            value={`${num(listedCount)} / ${num(collection.maxSupply)}`}
            sub={`${listedPct.toFixed(1)}%`}
          />
          <Stat label="Minted" value={num(collection.minted)} />
          <Stat
            label="Owners"
            value={num(collection.holders)}
            sub={`${ownersPct.toFixed(1)}%`}
          />
        </dl>

        <Button onClick={onMint} disabled={soldOut} className="shrink-0 gap-2">
          {soldOut ? "Sold Out" : "MINT NFT"}
        </Button>
      </div>

      {infoOpen ? (
        <div className="border-t border-border bg-surface/60 px-4 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              By: <span className="font-medium text-foreground">@{collection.creator}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Crown className="size-4 text-primary" />
              Royalties: {collection.creatorFee}%
            </span>
            <span className="text-muted-foreground">
              Created <ClientDate iso={collection.createdAt} />
            </span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {collection.description}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Star className="size-4" />
              Add to Watchlist
            </Button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Flag className="size-3.5" />
              Flag Collection
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className={cn("font-display text-sm font-semibold", accent && "text-foreground")}
        >
          {value}
        </span>
        {sub ? <span className="text-[11px] text-muted-foreground">{sub}</span> : null}
      </dd>
    </div>
  );
}
