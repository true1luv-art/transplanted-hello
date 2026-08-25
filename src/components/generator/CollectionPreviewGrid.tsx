import { cn } from "@/lib/utils";
import type { GeneratedNFT } from "@/features/lib/generator/types";

export function CollectionPreviewGrid({
  nfts,
  total,
  selectedTokenId,
  onSelect,
}: {
  nfts: GeneratedNFT[];
  total: number;
  selectedTokenId: number | null;
  onSelect: (tokenId: number) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
          Collection preview
        </h2>
        <span className="text-xs text-muted-foreground">
          {nfts.length} of {total} shown
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {nfts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No items match the current filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {nfts.map((nft) => (
              <button
                key={nft.tokenId}
                type="button"
                onClick={() => onSelect(nft.tokenId)}
                className={cn(
                  "overflow-hidden rounded-xl border bg-surface text-left transition-colors",
                  nft.tokenId === selectedTokenId
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className="relative aspect-square bg-surface-raised">
                  {(nft.thumbnailUrl ?? nft.previewUrl) && (
                    <img
                      src={nft.thumbnailUrl ?? nft.previewUrl}
                      alt={nft.name}
                      loading="lazy"
                      className="absolute inset-0 size-full object-contain"
                    />
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium">{nft.name}</p>
                  <p className="text-[11px] text-muted-foreground">#{nft.tokenId}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
