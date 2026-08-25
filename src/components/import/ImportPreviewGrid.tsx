import { num } from "@/lib/format";
import type { ImportedNft } from "@/features/lib/import/types";

const PREVIEW_LIMIT = 24;

/** Sample of the imported collection, rarest ranks first. */
export function ImportPreviewGrid({ nfts }: { nfts: ImportedNft[] }) {
  const sample = [...nfts].sort((a, b) => a.rarityRank - b.rarityRank).slice(0, PREVIEW_LIMIT);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Showing {num(sample.length)} of {num(nfts.length)} imported NFTs (rarest first)
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sample.map((nft) => (
          <figure
            key={nft.tokenId}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            {nft.previewUrl ? (
              <img
                src={nft.previewUrl}
                alt={nft.name}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-xs text-muted-foreground">
                no image
              </div>
            )}
            <figcaption className="space-y-0.5 p-2">
              <p className="truncate text-xs font-medium">{nft.name}</p>
              <p className="text-[11px] text-muted-foreground">
                #{nft.tokenId} · rank {num(nft.rarityRank)} · {nft.attributes.length} traits
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
