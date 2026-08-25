import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

import { IpfsImage } from "@/components/IpfsImage";
import { hive, num } from "@/lib/format";
import type { Collection } from "@/features/types/domain/collections";

export function TopCollectionsTable({ collections }: { collections: Collection[] }) {
  return (
    <div className="surface-card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="w-12 py-3 pl-4 font-medium">#</th>
            <th className="py-3 font-medium">Collection</th>
            <th className="py-3 text-right font-medium">Floor</th>
            <th className="py-3 text-right font-medium">Mint</th>
            <th className="py-3 text-right font-medium">Volume</th>
            <th className="py-3 text-right font-medium">Holders</th>
            <th className="py-3 pr-4 text-right font-medium">Minted</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c, i) => {
            const pct = Math.round((c.minted / c.maxSupply) * 100);
            return (
              <tr key={c.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface">
                <td className="py-3 pl-4 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="py-3">
                  <Link
                    to="/collections/$id"
                    params={{ id: c.id }}
                    className="group flex items-center gap-3"
                  >
                    <IpfsImage
                      src={c.image}
                      alt={`${c.name} artwork`}
                      className="size-9 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium group-hover:text-primary">
                          {c.name}
                        </span>
                        {c.status === "Sold Out" ? (
                          <BadgeCheck className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        by @{c.creator}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="py-3 text-right font-display font-semibold tabular-nums">
                  {hive(c.floorPrice)}
                </td>
                <td className="py-3 text-right tabular-nums">{hive(c.mintPrice)}</td>
                <td className="py-3 text-right tabular-nums">{hive(c.volume, 0)}</td>
                <td className="py-3 text-right tabular-nums">{num(c.holders)}</td>
                <td className="py-3 pr-4 text-right">
                  <span className="tabular-nums">{pct}%</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {num(c.minted)} / {num(c.maxSupply)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
