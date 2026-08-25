import { Link } from "@tanstack/react-router";
import { IpfsImage } from "@/components/IpfsImage";
import { Progress } from "@/components/ui/progress";
import { hive, num } from "@/lib/format";
import type { Collection } from "@/features/types/domain/collections";
import { cn } from "@/lib/utils";

export function CollectionCard({ collection }: { collection: Collection }) {
  const pct = Math.round((collection.minted / collection.maxSupply) * 100);

  return (
    <Link
      to="/collections/$id"
      params={{ id: collection.id }}
      className="surface-card group flex flex-col overflow-hidden transition-all hover:border-border-strong hover:shadow-[var(--shadow-glow)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <IpfsImage
          src={collection.image}
          alt={`${collection.name} cover artwork`}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className={cn(
            "absolute top-3 right-3 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase backdrop-blur-sm",
            collection.status === "Minting"
              ? "border-success/30 bg-success/10 text-success"
              : "border-border-strong bg-background/60 text-muted-foreground",
          )}
        >
          {collection.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold group-hover:text-primary">
            {collection.name}
          </h3>
          <p className="text-xs text-muted-foreground">by @{collection.creator}</p>
        </div>

        <div>
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              {num(collection.minted)} / {num(collection.maxSupply)} minted
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
          <div>
            <dt className="text-muted-foreground">Mint</dt>
            <dd className="mt-0.5 font-display font-semibold">{hive(collection.mintPrice)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Floor</dt>
            <dd className="mt-0.5 font-display font-semibold">{hive(collection.floorPrice)}</dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
