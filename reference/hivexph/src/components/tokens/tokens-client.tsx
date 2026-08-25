
import { useState, useMemo, useRef, useEffect } from "react";
import { useApi, fetchTokens, fetchTokenSparklines, type TokenRow as TokenRowData, type SparklineMap } from "@/hooks/useAxios";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  TrendingUp,
  Info,
  Flame,
  Rocket,
  Snowflake,
  ChevronLeft,
  ChevronRight,
  Coins,
  Star,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AllOpenOrders } from "./all-open-orders";


// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenRow {
  symbol: string;
  name: string;
  icon: string | null;
  issuer: string;
  precision: number;
  maxSupply: string;
  circulatingSupply: string;
  lastPrice: string;
  lastPriceUsd: string;
  volume: string;
  volumeUsd: string;
  priceChangePercent: string;
  priceChangeHive: string;
  lowestAsk: string;
  highestBid: string;
  marketCap: string;
  marketCapUsd: string;
  hivePriceUsd: number;
}

type SortKey = "marketCap" | "lastPrice" | "priceChangePercent" | "volume" | "circulatingSupply";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(val: string | number, decimals = 8): string {
  const n = parseFloat(String(val));
  if (isNaN(n)) return "—";
  if (n === 0) return "0";
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return n.toFixed(Math.min(decimals, 8));
}

function fmtUsd(val: string | number): string {
  const n = parseFloat(String(val));
  if (isNaN(n) || n === 0) return "$0.00";
  if (Math.abs(n) >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 0.01) return "$" + n.toFixed(2);
  return "$" + n.toFixed(6);
}

function fmtPct(raw: string): { text: string; positive: boolean } {
  const clean = raw.replace("%", "").trim();
  const n = parseFloat(clean);
  if (isNaN(n)) return { text: "0.00%", positive: true };
  return { text: `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`, positive: n >= 0 };
}

function numVal(row: TokenRow, key: SortKey): number {
  switch (key) {
    case "marketCap": return parseFloat(row.marketCap) || 0;
    case "lastPrice": return parseFloat(row.lastPrice) || 0;
    case "volume": return parseFloat(row.volume) || 0;
    case "circulatingSupply": return parseFloat(row.circulatingSupply) || 0;
    case "priceChangePercent": return parseFloat(row.priceChangePercent.replace("%", "")) || 0;
  }
}

// ── Sort header component ─────────────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      {active ? (
        dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

// ── Token info popover ────────────────────────────────────────────────────────

function TokenInfoPopover({ token }: { token: TokenRow }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`Info for ${token.symbol}`}
        className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus:outline-none"
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[230px] rounded-md border border-border bg-popover p-3 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Token Info</p>
          {[
            { label: "Symbol", value: token.symbol, mono: true },
            { label: "Name",   value: token.name },
            { label: "Issuer", value: `@${token.issuer}` },
            { label: "Precision", value: String(token.precision), mono: true },
            { label: "Max Supply", value: Number(token.maxSupply).toLocaleString(), mono: true },
            { label: "Circulating", value: Number(token.circulatingSupply).toLocaleString(), mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between border-t border-border/30 py-1">
              <span className="text-[12px] text-muted-foreground">{label}</span>
              <span className={`text-[12px] text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Highlights section moved to src/components/tokens/token-highlights.tsx



// ── Main component ────────────────────────────────────────────────────────────

export function TokensClient({ username, isLoggedIn }: { username: string; isLoggedIn: boolean }) {
  const { data: tokens, isLoading } = useApi<TokenRowData[]>(
    ['tokens', fetchTokens],
    { refreshInterval: 60_000 },
  );


  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tab, setTab] = useState<"all" | "orders" | "watchlist">("all");
  const [watch, setWatch] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("hivep2p_token_watchlist");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  const toggleWatch = (sym: string) => {
    setWatch((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      try { localStorage.setItem("hivep2p_token_watchlist", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const { totalMarketCapUsd, totalVolumeUsd, totalTokens } = useMemo(() => {
    const list = tokens ?? [];
    return {
      totalMarketCapUsd: list.reduce((s, t) => s + (parseFloat(t.marketCapUsd) || 0), 0),
      totalVolumeUsd: list.reduce((s, t) => s + (parseFloat(t.volumeUsd) || 0), 0),
      totalTokens: list.length,
    };
  }, [tokens]);

  const rows = useMemo(() => {
    if (!tokens) return [];
    let filtered = tokens;
    if (tab === "watchlist") filtered = filtered.filter((t) => watch.has(t.symbol));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.issuer.toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      const diff = numVal(a, sortKey) - numVal(b, sortKey);
      return sortDir === "desc" ? -diff : diff;
    });
  }, [tokens, search, sortKey, sortDir, tab, watch]);

  return (
    <div className="flex min-w-0 flex-col gap-4">

      <PageHeader
        icon={Coins}
        title="Tokens"
        description="Explore every Hive Engine token with live prices, market caps, and volume."
        stats={[
          { label: "Total Market Cap", value: fmtUsd(totalMarketCapUsd) },
          { label: "Tokens", value: fmtNum(totalTokens, 0) },
          { label: "24h Volume", value: fmtUsd(totalVolumeUsd) },
        ]}
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60">
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>All Tokens</TabBtn>
        <TabBtn active={tab === "orders"} onClick={() => setTab("orders")}>My Open Orders</TabBtn>
        <TabBtn active={tab === "watchlist"} onClick={() => setTab("watchlist")}>
          Watchlist
          {watch.size > 0 && (
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
              {watch.size}
            </span>
          )}
        </TabBtn>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tokens…"
          className="w-full rounded-xl border border-border/60 bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>



      {/* Table */}
      <div className="rounded-lg border border-border/60 bg-card/20 overflow-hidden">
        {tab === "orders" ? (
          <AllOpenOrders username={username} isLoggedIn={isLoggedIn} />
        ) : tab === "watchlist" && watch.size === 0 ? (
          <div className="py-16 text-center font-mono text-[13px] text-muted-foreground">
            Watchlist is empty. Tap the star next to any token to add it.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-card/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                  Token
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="Price" sortKey="lastPrice" active={sortKey === "lastPrice"} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="Market Cap" sortKey="marketCap" active={sortKey === "marketCap"} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="24h %" sortKey="priceChangePercent" active={sortKey === "priceChangePercent"} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader label="24h Volume" sortKey="volume" active={sortKey === "volume"} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-8 animate-pulse rounded-full bg-muted/30" />
                          <div className="space-y-1">
                            <div className="h-3 w-16 animate-pulse rounded bg-muted/30" />
                            <div className="h-2.5 w-24 animate-pulse rounded bg-muted/20" />
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted/30" />
                        </td>
                      ))}
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                : rows.map((token) => {
                    const pct = fmtPct(token.priceChangePercent);
                    const isWatched = watch.has(token.symbol);
                    return (
                      <tr key={token.symbol} className="border-b border-border/30 transition-colors hover:bg-accent/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {token.icon ? (
                              <img
                                src={token.icon}
                                alt={token.symbol}
                                width={32}
                                height={32}
                                className="size-8 flex-shrink-0 rounded-full object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
                                {token.symbol.slice(0, 2)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{token.symbol}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{token.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-mono text-foreground">{fmtNum(token.lastPrice, 8)} HIVE</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{fmtUsd(token.lastPriceUsd)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-mono font-medium text-foreground">{fmtUsd(token.marketCapUsd)}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{fmtNum(token.marketCap, 2)} HIVE</p>
                        </td>
                        <td className={cn("px-4 py-3 text-right font-mono font-medium", pct.positive ? "text-emerald-400" : "text-rose-400")}>
                          {pct.text}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-mono font-medium text-foreground">{fmtNum(token.volume, 2)} HIVE</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{fmtUsd(token.volumeUsd)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => toggleWatch(token.symbol)}
                              title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                              className={cn(
                                "flex size-7 items-center justify-center rounded border transition-colors",
                                isWatched
                                  ? "border-primary/50 bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
                              )}
                            >
                              <Star className={cn("size-3.5", isWatched && "fill-current")} />
                            </button>
                            <Link
                              to={`/trade?symbol=${token.symbol}`}
                              title={`Trade ${token.symbol}`}
                              className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                            >
                              <TrendingUp className="size-3.5" />
                            </Link>
                            <TokenInfoPopover token={token} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          </div>
        )}

        {!isLoading && tab !== "orders" && !(tab === "watchlist" && watch.size === 0) && rows.length === 0 && (
          <div className="py-16 text-center font-mono text-[13px] text-muted-foreground">
            No tokens found{search ? ` matching "${search}"` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center px-4 py-2.5 text-sm font-bold transition-colors",
        active
          ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

