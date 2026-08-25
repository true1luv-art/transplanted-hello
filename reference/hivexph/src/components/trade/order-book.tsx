import { useState } from "react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface OrderEntry {
  _id: number;
  account: string;
  symbol: string;
  quantity: string;
  price: string;
}

interface Props {
  symbol: string;
  buyBook: OrderEntry[];
  sellBook: OrderEntry[];
  lastPrice: string;
  onPriceClick?: (price: string, side: "buy" | "sell") => void;
}

interface AggRow {
  price: string;
  qty: number;
  hive: number;
  orders: OrderEntry[];
}

function fmt(s: string | number, dec = 8) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return isNaN(n) ? "—" : n.toFixed(dec);
}

function aggregate(orders: OrderEntry[], dir: "asc" | "desc"): AggRow[] {
  const map = new Map<string, OrderEntry[]>();
  for (const o of orders) {
    const arr = map.get(o.price) ?? [];
    arr.push(o);
    map.set(o.price, arr);
  }
  return Array.from(map.entries())
    .map(([price, group]) => {
      const qty = group.reduce((s, o) => s + parseFloat(o.quantity), 0);
      return { price, qty, hive: parseFloat(price) * qty, orders: group };
    })
    .sort((a, b) => dir === "asc"
      ? parseFloat(a.price) - parseFloat(b.price)
      : parseFloat(b.price) - parseFloat(a.price));
}

export function OrderBook({ symbol, buyBook, sellBook, lastPrice, onPriceClick }: Props) {
  const [view, setView] = useState<"both" | "sells" | "buys">("both");
  const rowLimit = view === "both" ? 14 : 28;

  // Sells: ascending (lowest ask near spread), but rendered top-down so we reverse to show highest at top
  const sellsAsc = aggregate(sellBook, "asc").slice(0, rowLimit);
  const sells = [...sellsAsc].reverse(); // top = highest ask, bottom = lowest ask (closest to spread)
  const buys = aggregate(buyBook, "desc").slice(0, rowLimit);

  const maxHive = Math.max(
    ...sells.map((s) => s.hive),
    ...buys.map((b) => b.hive),
    1,
  );

  const bestBid = buys[0] ? parseFloat(buys[0].price) : 0;
  const bestAsk = sellsAsc[0] ? parseFloat(sellsAsc[0].price) : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const spreadPct = bestAsk ? (spread / bestAsk) * 100 : 0;

  const filterButtons: Array<{ id: "both" | "sells" | "buys"; label: string }> = [
    { id: "both", label: "Show buys and sells" },
    { id: "sells", label: "Show sells only" },
    { id: "buys", label: "Show buys only" },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Order Book
          </span>
          <div className="flex items-center gap-1">
            {filterButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setView(b.id)}
                aria-label={b.label}
                aria-pressed={view === b.id}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md border border-border/50 transition hover:border-border",
                  view === b.id && "border-primary/60 bg-primary/10",
                )}
              >
                <BookIcon variant={b.id} />
              </button>
            ))}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">{symbol}/HIVE</span>
      </div>

      {/* Column header */}
      <div className="grid grid-cols-3 gap-2 border-b border-border/30 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Price (HIVE)</span>
        <span className="text-right text-[10px] uppercase tracking-wider text-muted-foreground">Amount ({symbol})</span>
        <span className="text-right text-[10px] uppercase tracking-wider text-muted-foreground">Total (HIVE)</span>
      </div>

      {/* Sells (asks) — top */}
      {view !== "buys" && (
        <div className="flex flex-col">
          {sells.length === 0 ? (
            <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">No sell orders</p>
          ) : (
            sells.map((row, i) => (
              <OrderRow
                key={`s-${i}`}
                side="sell"
                row={row}
                symbol={symbol}
                maxHive={maxHive}
                onPriceClick={onPriceClick}
              />
            ))
          )}
        </div>
      )}

      {/* Spread row */}
      <div className="flex items-center gap-3 border-y border-border/40 bg-muted/20 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Spread</span>
        <span className="font-mono text-[12px] font-semibold text-foreground">{fmt(lastPrice)}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {spread > 0 ? `${fmt(spread.toString(), 8)} (${spreadPct.toFixed(4)}%)` : "—"}
        </span>
      </div>

      {/* Buys (bids) — bottom */}
      {view !== "sells" && (
        <div className="flex flex-col">
          {buys.length === 0 ? (
            <p className="px-3 py-3 text-center text-[11px] text-muted-foreground">No buy orders</p>
          ) : (
            buys.map((row, i) => (
              <OrderRow
                key={`b-${i}`}
                side="buy"
                row={row}
                symbol={symbol}
                maxHive={maxHive}
                onPriceClick={onPriceClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function OrderRow({
  side,
  row,
  symbol,
  maxHive,
  onPriceClick,
}: {
  side: "buy" | "sell";
  row: AggRow;
  symbol: string;
  maxHive: number;
  onPriceClick?: (price: string, side: "buy" | "sell") => void;
}) {
  const isSell = side === "sell";
  const priceColor = isSell ? "text-rose-400" : "text-emerald-400";
  const hoverBg = isSell ? "hover:bg-rose-500/10" : "hover:bg-emerald-500/10";
  const barBg = isSell ? "bg-rose-500/12" : "bg-emerald-500/12";
  // Clicking a sell row prefills the buy form; clicking a buy row prefills the sell form
  const clickSide: "buy" | "sell" = isSell ? "buy" : "sell";
  const sortedOrders = [...row.orders].sort(
    (a, b) => parseFloat(b.quantity) - parseFloat(a.quantity),
  );

  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onPriceClick?.(row.price, clickSide)}
          className={cn(
            "relative grid w-full grid-cols-3 gap-2 px-3 py-[3px] text-left text-[11px] cursor-pointer overflow-hidden",
            hoverBg,
          )}
        >
          <span
            className={cn("pointer-events-none absolute inset-y-0 right-0", barBg)}
            style={{ width: `${Math.min((row.hive / maxHive) * 100, 100)}%` }}
          />
          <span className={cn("relative font-mono", priceColor)}>{fmt(row.price)}</span>
          <span className="relative text-right font-mono text-foreground">{fmt(row.qty)}</span>
          <span className="relative text-right font-mono text-foreground">{fmt(row.hive)}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side={isSell ? "left" : "left"}
        align="start"
        className="w-72 p-0"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isSell ? "Sellers" : "Buyers"} at this price
          </span>
          <span className={cn("font-mono text-[11px] font-semibold", priceColor)}>
            {fmt(row.price)}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border/40 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Account</span>
          <span className="text-right">Amount ({symbol})</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {sortedOrders.map((o) => (
            <div
              key={o._id}
              className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1 text-[11px]"
            >
              <a
                href={`https://peakd.com/@${o.account}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="truncate font-medium text-foreground hover:text-primary hover:underline"
              >
                @{o.account}
              </a>
              <span className="text-right font-mono text-muted-foreground">
                {fmt(o.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span>{sortedOrders.length} order{sortedOrders.length === 1 ? "" : "s"}</span>
          <span className="font-mono">
            Total: {fmt(row.qty)} {symbol}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function BookIcon({ variant }: { variant: "both" | "sells" | "buys" }) {
  // 2x2 grid: top row = sells (rose), bottom row = buys (emerald)
  const sellColor = "#fb7185"; // rose-400
  const buyColor = "#34d399"; // emerald-400
  const dim = "rgba(148, 163, 184, 0.35)"; // muted

  const tl = variant === "buys" ? dim : sellColor;
  const tr = variant === "buys" ? dim : sellColor;
  const bl = variant === "sells" ? dim : buyColor;
  const br = variant === "sells" ? dim : buyColor;

  return (
    <svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true">
      <rect x="1" y="1" width="5" height="5" rx="1" fill={tl} />
      <rect x="8" y="1" width="5" height="5" rx="1" fill={tr} />
      <rect x="1" y="8" width="5" height="5" rx="1" fill={bl} />
      <rect x="8" y="8" width="5" height="5" rx="1" fill={br} />
    </svg>
  );
}
