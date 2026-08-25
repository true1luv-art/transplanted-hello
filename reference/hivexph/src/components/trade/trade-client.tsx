
import { useState, useCallback, useRef, useEffect } from "react";
import { useApi, fetchTradeTokens, fetchTradeMarket } from "@/hooks/useAxios";
import type { TokenListItem, MarketData } from "@/lib/fetchers/trade";
import { useSearchParams, useRouter } from "@/lib/next-nav-shim";
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown, Info, CandlestickChart, ArrowLeftRight, BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OhlcvChart } from "./ohlcv-chart";
import { DepthChart } from "./depth-chart";
import { OrderBook } from "./order-book";
import { TradeHistory } from "./trade-history";
import { OpenOrders } from "./open-orders";
import { OrderForm } from "./order-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderEntry {
  _id: number;
  account: string;
  symbol: string;
  quantity: string;
  price: string;
}

interface OhlcvEntry {
  timestamp: number;
  openPrice: string;
  closePrice: string;
  highestPrice: string;
  lowestPrice: string;
  volumeHive: string;
  volumeToken: string;
}

interface Metrics {
  lastPrice: string;
  highestBid: string;
  lowestAsk: string;
  volume: string;
  priceChangePercent: string;
  priceChangeHive: string;
}

interface TradeEntry {
  _id: number;
  type: "buy" | "sell";
  buyer: string;
  seller: string;
  symbol: string;
  quantity: string;
  price: string;
  timestamp: number;
  volume: string;
}

interface TokenInfo {
  name: string;
  symbol: string;
  precision: number;
  maxSupply: string;
  circulatingSupply: string;
  issuer: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(s: string | undefined) {
  if (!s) return 0;
  return parseFloat(s.replace("%", ""));
}

function fmtPrice(s: string | undefined, decimals = 8) {
  if (!s) return "—";
  const n = parseFloat(s);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

// ── Token selector combobox ───────────────────────────────────────────────────

function TokenSelector({
  tokens,
  loading,
  activeSymbol,
  onSelect,
}: {
  tokens: TokenListItem[];
  loading: boolean;
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 min-w-[130px] items-center gap-2 rounded-md border border-border bg-background px-3 text-[14px] font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none"
      >
        {/* Show active token icon if available */}
        {(() => {
          const active = tokens.find((t) => t.symbol === activeSymbol);
          return active?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.icon}
              alt={activeSymbol}
              width={18}
              height={18}
              className="size-[18px] flex-shrink-0 rounded-full object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : null;
        })()}
        <span className="flex-1 text-left font-mono">{activeSymbol}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[280px] overflow-hidden rounded-md border border-border bg-popover shadow-xl">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 flex-shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Token list */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">No tokens found</p>
            ) : (
              filtered.map((t) => {
                const change = pct(t.priceChangePercent);
                const pos = change >= 0;
                return (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => { onSelect(t.symbol); setOpen(false); setSearch(""); }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-accent/60",
                      t.symbol === activeSymbol && "bg-primary/10",
                    )}
                  >
                    {/* Icon */}
                    {t.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.icon}
                        alt={t.symbol}
                        width={22}
                        height={22}
                        className="size-[22px] flex-shrink-0 rounded-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="flex size-[22px] flex-shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                        {t.symbol.slice(0, 2)}
                      </span>
                    )}
                    {/* Symbol + name */}
                    <span className="w-[72px] flex-shrink-0 font-mono font-semibold text-foreground">{t.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{t.name}</span>
                    {/* Price + change */}
                    <div className="flex-shrink-0 text-right">
                      <div className="font-mono text-[12px] text-foreground">{fmtPrice(t.lastPrice, 6)}</div>
                      <div className={cn("font-mono text-[10px]", pos ? "text-emerald-400" : "text-rose-400")}>
                        {pos ? "+" : ""}{t.priceChangePercent}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-[13px] font-medium text-foreground">{value}</span>
      {sub && <span className="font-mono text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── Main component ───────────────────────────────��────────────────────────────

// ── Token info popover ────────────────────────────────────────────────────────

function TokenInfoPopover({ tokenInfo }: { tokenInfo: TokenInfo | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!tokenInfo) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none"
        aria-label="Token info"
      >
        <Info className="size-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[220px] rounded-md border border-border bg-popover p-3 shadow-xl">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Token Info</p>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-muted-foreground">Symbol</span>
            <span className="font-mono text-[12px] font-semibold text-foreground">{tokenInfo.symbol}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-muted-foreground">Name</span>
            <span className="text-[12px] text-foreground">{tokenInfo.name}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-muted-foreground">Precision</span>
            <span className="font-mono text-[12px] text-foreground">{tokenInfo.precision}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-muted-foreground">Max Supply</span>
            <span className="font-mono text-[12px] text-foreground">
              {Number(tokenInfo.maxSupply).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-muted-foreground">Circulating</span>
            <span className="font-mono text-[12px] text-foreground">
              {Number(tokenInfo.circulatingSupply).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-muted-foreground">Issuer</span>
            <span className="text-[12px] text-foreground">@{tokenInfo.issuer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TradeClient({ username }: { username: string | null }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [chartView, setChartView] = useState<"candle" | "volume" | "depth">("candle");
  const [formPrice, setFormPrice] = useState("");
  const [formSide, setFormSide] = useState<"buy" | "sell">("buy");
  const [mobileTab, setMobileTab] = useState<"trade" | "chart" | "book">("trade");

  const activeSymbol = searchParams.get("symbol")?.toUpperCase() ?? "BEE";

  const setSymbol = useCallback(
    (sym: string) => {
      router.push(`/trade?symbol=${sym}`);
    },
    [router],
  );

  // Token list for the dropdown
  const { data: tokens, isLoading: tokensLoading } = useApi<TokenListItem[]>(
    ['trade-tokens', fetchTradeTokens],
    { refreshInterval: 60_000 },
  );

  // Market data for active symbol
  const {
    data: market,
    isLoading: marketLoading,
    mutate: refreshMarket,
  } = useApi<MarketData>(
    [`trade-market-${activeSymbol}`, () => fetchTradeMarket(activeSymbol)],
    { refreshInterval: 15_000 },
  );

  const metrics = market?.metrics;
  const hivePriceUsd = market?.hivePriceUsd ?? 0;
  const change = pct(metrics?.priceChangePercent);
  const positive = change >= 0;

  return (
    // Negative margins escape the AppShell padding so trade is full-bleed.
    <div className="flex flex-col">
      <div className="mb-4">
        <PageHeader
          icon={CandlestickChart}
          title="Trade"
          description="Place limit orders on the Hive Engine DEX with live charts and order books."
        />
      </div>
      {/* ── Pair header strip (matches Swap page styling) ── */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <TokenSelector
            tokens={tokens ?? []}
            loading={tokensLoading}
            activeSymbol={activeSymbol}
            onSelect={setSymbol}
          />
          <TokenInfoPopover tokenInfo={market?.tokenInfo ?? null} />
          {metrics && (
            <Badge
              variant="secondary"
              className={cn(
                "ml-1 font-mono text-[11px]",
                positive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
              )}
            >
              {positive
                ? <ChevronUp className="mr-0.5 size-3" />
                : <ChevronDown className="mr-0.5 size-3" />}
              {metrics.priceChangePercent}
            </Badge>
          )}
        </div>

        {marketLoading || !metrics ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <StatChip
              label="Last Price"
              value={fmtPrice(metrics.lastPrice)}
              sub={hivePriceUsd > 0 ? `$${(parseFloat(metrics.lastPrice) * hivePriceUsd).toFixed(6)}` : undefined}
            />
            <StatChip label="24h Change" value={metrics.priceChangeHive} sub={metrics.priceChangePercent} />
            <StatChip label="Bid" value={fmtPrice(metrics.highestBid)} />
            <StatChip label="Ask" value={fmtPrice(metrics.lowestAsk)} />
            <StatChip
              label="Volume (24h)"
              value={parseFloat(metrics.volume).toLocaleString(undefined, { maximumFractionDigits: 3 })}
              sub={hivePriceUsd > 0 ? `$${(parseFloat(metrics.volume) * hivePriceUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : undefined}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">

      {/* ── Mobile tab nav (hidden on lg+) ── */}
      <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-card p-1 lg:hidden">
        {([
          { id: "trade", label: "Trade", Icon: ArrowLeftRight },
          { id: "chart", label: "Chart", Icon: CandlestickChart },
          { id: "book", label: "Order Book", Icon: BookOpen },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors",
              mobileTab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* ── 2-column workspace (lg+); single panel per tab on mobile ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* Left: Order book */}
        <div className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card lg:order-1 lg:block",
          mobileTab === "book" ? "block" : "hidden",
        )}>
          {marketLoading || !market ? (
            <div className="p-4"><Skeleton className="h-[460px] w-full rounded-lg" /></div>
          ) : (
            <OrderBook
              symbol={activeSymbol}
              buyBook={market.buyBook}
              sellBook={market.sellBook}
              lastPrice={market.metrics?.lastPrice ?? "0"}
              onPriceClick={(price, side) => { setFormPrice(price); setFormSide(side); setMobileTab("trade"); }}
            />
          )}
        </div>

        {/* Center: Chart + Order form (both visible together on desktop; split on mobile) */}
        <div className="flex min-w-0 flex-col gap-4 lg:order-2">
          {/* Chart panel */}
          <div className={cn(
            "overflow-hidden rounded-2xl border border-border bg-card lg:block",
            mobileTab === "chart" ? "block" : "hidden",
          )}>
            <div className="flex items-center gap-1 border-b border-border/50 px-4 py-2">
              {(["candle", "volume", "depth"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChartView(v)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    chartView === v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="p-4">
              {marketLoading || !market ? (
                <Skeleton className="min-h-[380px] w-full rounded-lg" />
              ) : chartView === "depth" ? (
                <DepthChart
                  buyBook={market.buyBook}
                  sellBook={market.sellBook}
                  lastPrice={market.metrics?.lastPrice ?? "0"}
                />
              ) : (
                <OhlcvChart data={market.ohlcv} view={chartView} />
              )}
            </div>
          </div>

          {/* Order form */}
          <div className={cn(
            "overflow-hidden rounded-2xl border border-border bg-card lg:block",
            mobileTab === "trade" ? "block" : "hidden",
          )}>
            {marketLoading || !market ? (
              <div className="p-4"><Skeleton className="h-[360px] w-full rounded-lg" /></div>
            ) : (
              <OrderForm
                symbol={activeSymbol}
                username={username}
                initialSide={formSide}
                initialPrice={formPrice}
                precision={market.tokenInfo?.precision ?? 8}
              />
            )}
          </div>
        </div>
      </div>


      {/* ── Bottom tabs: Open Orders | My Trades | Trade History ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">

        <Tabs defaultValue={username ? "open" : "history"} className="w-full">
          <TabsList className="m-3 bg-muted/40">
            {username && <TabsTrigger value="open">Open Orders</TabsTrigger>}
            {username && <TabsTrigger value="mine">My Trades</TabsTrigger>}
            <TabsTrigger value="history">Trade History</TabsTrigger>
          </TabsList>
          {username && (
            <TabsContent value="open" className="mt-0">
              <OpenOrders username={username} symbol={activeSymbol} />
            </TabsContent>
          )}
          {username && (
            <TabsContent value="mine" className="mt-0">
              {marketLoading || !market ? (
                <div className="p-4"><Skeleton className="h-64 w-full" /></div>
              ) : (
                <TradeHistory
                  trades={market.tradesHistory.filter(
                    (t) => t.buyer === username || t.seller === username,
                  )}
                  symbol={activeSymbol}
                />
              )}
            </TabsContent>
          )}
          <TabsContent value="history" className="mt-0">
            {marketLoading || !market ? (
              <div className="p-4"><Skeleton className="h-64 w-full" /></div>
            ) : (
              <TradeHistory trades={market.tradesHistory} symbol={activeSymbol} />
            )}
          </TabsContent>
        </Tabs>
      </div>
      </div>

    </div>
  );
}

// ── Token list sidebar panel ──────────────────────────────────────────────────

function TokenListPanel({
  tokens,
  loading,
  activeSymbol,
  onSelect,
}: {
  tokens: TokenListItem[];
  loading: boolean;
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? tokens.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q),
      )
    : tokens.slice(0, 10);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        <Search className="size-3.5 flex-shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search markets…"
          className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Pair</span>
        <span className="text-right">Price</span>
        <span className="text-right">Chg</span>
      </div>
      <div>

        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">No tokens</p>
        ) : (
          filtered.map((t) => {
            const change = pct(t.priceChangePercent);
            const pos = change >= 0;
            return (
              <button
                key={t.symbol}
                type="button"
                onClick={() => onSelect(t.symbol)}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-accent/60",
                  t.symbol === activeSymbol && "bg-primary/10",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {t.icon ? (
                    <img
                      src={t.icon}
                      alt={t.symbol}
                      width={18}
                      height={18}
                      className="size-[18px] flex-shrink-0 rounded-full object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span className="flex size-[18px] flex-shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                      {t.symbol.slice(0, 2)}
                    </span>
                  )}
                  <span className="truncate font-mono text-[12px] font-semibold text-foreground">{t.symbol}</span>
                </div>
                <span className="text-right font-mono text-[11px] text-foreground">{fmtPrice(t.lastPrice, 6)}</span>
                <span className={cn("text-right font-mono text-[10px]", pos ? "text-emerald-400" : "text-rose-400")}>
                  {pos ? "+" : ""}{t.priceChangePercent}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
