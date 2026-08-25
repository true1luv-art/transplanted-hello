import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ClientTime } from "@/components/ClientTime";
import { IpfsImage } from "@/components/IpfsImage";
import { hive } from "@/lib/format";
import type { Listing } from "@/features/types/domain/marketplace";
import type { NFT } from "@/features/types/domain/nfts";
import { cn } from "@/lib/utils";

interface NFTCardProps {
  nft: NFT;
  listing?: Listing | undefined;
  action?: { label: string; onClick: () => void; variant?: "default" | "outline" } | undefined;
  className?: string;
}

export function NFTCard({ nft, listing, action, className }: NFTCardProps) {
  return (
    <article
      className={cn(
        "surface-card group flex flex-col overflow-hidden transition-all hover:border-border-strong hover:shadow-[var(--shadow-glow)]",
        className,
      )}
    >
      <Link
        to="/nfts/$id"
        params={{ id: nft.id }}
        className="relative block aspect-square overflow-hidden"
      >
        <IpfsImage
          src={nft.image}
          alt={`${nft.name} artwork`}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{nft.collectionName}</p>
          <Link
            to="/nfts/$id"
            params={{ id: nft.id }}
            className="block truncate font-display text-base font-semibold hover:text-primary"
          >
            {nft.name}
          </Link>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
              {listing ? "Price" : "Est. value"}
            </p>
            <p className="font-display text-sm font-semibold">
              {hive(listing ? listing.price : nft.estimatedValue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">
              {listing ? `@${listing.seller}` : `@${nft.owner}`}
            </p>
            {listing ? (
              <ClientTime iso={listing.listedAt} className="text-[11px] text-muted-foreground" />
            ) : (
              <p className="text-[11px] text-muted-foreground">#{nft.mintNumber}</p>
            )}
          </div>
        </div>

        {action ? (
          <Button
            size="sm"
            variant={action.variant ?? "default"}
            onClick={action.onClick}
            className="w-full"
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
