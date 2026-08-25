"use client";

import { History, RefreshCw, Sword, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useServerLogs } from "@/hooks/useServerLogs";
import { marketLogMessage, toMarketRow } from "@/lib/logs-format";
import { formatHash, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type HistoryTab = "all" | "items" | "assets";

const RARITY_COLORS: Record<string, string> = {
  common: "text-muted-foreground",
  uncommon: "text-emerald-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-yellow-400",
};

const ACTION_COLORS: Record<string, string> = {
  sold: "text-green-400",
  bought: "text-blue-400",
  listed: "text-muted-foreground",
  cancelled: "text-destructive",
};

/** Public history of items/assets sold on the marketplace, read from the logs collection. */
export function MarketSalesHistory() {
  const [tab, setTab] = useState<HistoryTab>("all");

  const allLogs = useServerLogs("sales", true, 25);
  const itemLogs = useServerLogs("sales_items", tab === "items", 25);
  const assetLogs = useServerLogs("sales_assets", tab === "assets", 25);

  const active = tab === "items" ? itemLogs : tab === "assets" ? assetLogs : allLogs;

  const rows = active.logs.map(toMarketRow);

  return (
    <section className="card-soft space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4 text-muted-foreground" />
          Market history
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => void active.refresh()}
          disabled={active.loading}
        >
          <RefreshCw className={cn("size-3.5", active.loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Kind tabs */}
      <div className="flex gap-1.5">
        {(
          [
            ["all", "All", null],
            ["items", "Items", <Sword key="items" className="size-3" />],
            ["assets", "Assets", <Sparkles key="assets" className="size-3" />],
          ] as [HistoryTab, string, React.ReactNode][]
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              tab === key
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {active.loading
            ? "Loading history…"
            : tab === "items"
              ? "No item sales recorded yet."
              : tab === "assets"
                ? "No asset sales recorded yet."
                : "No marketplace sales recorded yet."}
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {/* Kind badge */}
                  {row.kind === "asset" ? (
                    <span className="inline-flex items-center gap-0.5 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                      <Sparkles className="size-2.5" />
                      Asset
                    </span>
                  ) : row.kind === "item" ? (
                    <span className="inline-flex items-center gap-0.5 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                      <Sword className="size-2.5" />
                      Item
                    </span>
                  ) : null}
                  {/* Action badge */}
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      ACTION_COLORS[row.action] ?? "text-muted-foreground",
                    )}
                  >
                    {row.action}
                  </span>
                  {row.rarity ? (
                    <span
                      className={cn(
                        "text-[10px] font-medium capitalize",
                        RARITY_COLORS[row.rarity] ?? "text-muted-foreground",
                      )}
                    >
                      {row.rarity}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate font-medium">{marketLogMessage(row)}</p>
                <p className="text-[11px] text-muted-foreground">
                  @{row.wallet.slice(0, 8)}…
                  {row.counterparty ? ` → @${row.counterparty.slice(0, 8)}…` : ""}
                  {" · "}
                  {formatRelativeTime(row.at)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-primary">
                {formatHash(row.price, 0)} HASH
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
