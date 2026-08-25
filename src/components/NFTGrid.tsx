import type { ReactNode } from "react";
import { NFTCard } from "@/components/NFTCard";
import { EmptyState } from "@/components/EmptyState";
import type { Listing } from "@/features/types/domain/marketplace";
import type { NFT } from "@/features/types/domain/nfts";

export function NFTGrid({
  nfts,
  listings = [],
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  renderAction,
}: {
  nfts: NFT[];
  listings?: Listing[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  renderAction?: (
    nft: NFT,
    listing?: Listing,
  ) => { label: string; onClick: () => void; variant?: "default" | "outline" } | undefined;
}) {
  if (!nfts.length) {
    return (
      <EmptyState
        title={emptyTitle}
        {...(emptyDescription ? { description: emptyDescription } : {})}
        {...(emptyAction ? { action: emptyAction } : {})}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {nfts.map((nft) => {
        const listing = listings.find((l) => l.nftId === nft.id);
        return (
          <NFTCard key={nft.id} nft={nft} listing={listing} action={renderAction?.(nft, listing)} />
        );
      })}
    </div>
  );
}
