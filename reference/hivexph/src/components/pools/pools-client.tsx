import { useMemo, useState } from "react";
import useSWR from "swr";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Waves,
  Plus,
  Search,
  Star,
} from "lucide-react";
import {
  fetchPools,
  fetchLiquidityPositions,
  type Pool,
  type LiquidityPosition,
} from "@/lib/fetchers/pools";
import { PageHeader } from "@/components/page-header";
import { CreatePoolDialog } from "@/components/pools/create-pool-dialog";
import { cn } from "@/lib/utils";

const appRoute = getRouteApi("/_app");

// ── Helpers ───────────────────────────────────────────────────────────────────

const WATCHLIST_KEY = "hivep2p_pool_watchlist";

function loadWatch(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveWatch(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...s]));
  } catch {
    /* noop */
  }
}

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  if (n < 0.0001) return n.toExponential(3);
  return n.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

function fmtUsd(n: number): string {
  if (!isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  if (n >= 1) return "$" + n.toFixed(2);
  return "$" + n.toFixed(4);
}

// ── TokenIcon ─────────────────────────────────────────────────────────────────

function TokenIcon({
  icon,
  symbol,
  size = 28,
}: {
  icon: string | null;
  symbol: string;
  size?: number;
}) {
  const [err, setErr] = useState(false);
  if (icon && !err) {
    return (
      <img
        src={icon}
        alt={symbol}
        width={size}
        height={size}
        crossOrigin="anonymous"
        onError={() => setErr(true)}
        className="flex-shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

function PairIcons({
  baseIcon,
  quoteIcon,
  base,
  quote,
}: {
  baseIcon: string | null;
  quoteIcon: string | null;
  base: string;
  quote: string;
}) {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 32 }}>
      <div className="absolute left-0 top-0">
        <TokenIcon icon={baseIcon} symbol={base} size={32} />
      </div>
      <div className="absolute left-[22px] top-0 rounded-full ring-2 ring-card">
        <TokenIcon icon={quoteIcon} symbol={quote} size={32} />
      </div>
    </div>
  );
}

// ── Sort + Tabs ───────────────────────────────────────────────────────────────

type SortKey = "liquidity" | "volume" | "price";
type SortDir = "asc" | "desc";
type Tab = "all" | "positions" | "watchlist";

// ── Main ──────────────────────────────────────────────────────────────────────

export function PoolsClient() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sortKey, setSortKey] = useState<SortKey>("liquidity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [watch, setWatch] = useState<Set<string>>(() => loadWatch());

  const { user } = appRoute.useLoaderData();
  const username = user?.username ?? "";

  const { data: pools, isLoading } = useSWR<Pool[]>("pools", fetchPools, {
    revalidateOnFocus: false,
    refreshInterval: 60_000,
  });

  const {
    data: positions,
    isLoading: positionsLoading,
  } = useSWR<LiquidityPosition[]>(
    username ? ["liquidityPositions", username] : null,
    () => fetchLiquidityPositions(username),
    { revalidateOnFocus: false, refreshInterval: 60_000 },
  );

  const toggleWatch = (pair: string) => {
    setWatch((prev) => {
      const next = new Set(prev);
      if (next.has(pair)) next.delete(pair);
      else next.add(pair);
      saveWatch(next);
      return next;
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Stats
  const stats = useMemo(() => {
    const list = pools ?? [];
    const tvl = list.reduce((s, p) => s + parseFloat(p.tvlUsd || "0"), 0);
    const vol = list.reduce((s, p) => s + parseFloat(p.volumeUsd || "0"), 0);
    return {
      tvl,
      pools: list.length,
      volume: vol,
      // Approximate AMM swap fees at 0.3% of volume
      fees: vol * 0.003,
    };
  }, [pools]);

  // Filter + sort
  const visible = useMemo(() => {
    let list = pools ?? [];
    if (tab === "watchlist") list = list.filter((p) => watch.has(p.tokenPair));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.tokenPair.toLowerCase().includes(q));
    }
    const dir = sortDir === "desc" ? -1 : 1;
    const priceOf = (p: Pool) => {
      const b = parseFloat(p.baseQuantity) || 0;
      const q = parseFloat(p.quoteQuantity) || 0;
      return b > 0 ? q / b : parseFloat(p.basePrice) || 0;
    };
    const sorted = [...list].sort((a, b) => {
      const av = (() => {
        switch (sortKey) {
          case "liquidity":
            return parseFloat(a.tvlUsd);
          case "volume":
            return parseFloat(a.volumeUsd);
          case "price":
            return priceOf(a);
        }
      })();
      const bv = (() => {
        switch (sortKey) {
          case "liquidity":
            return parseFloat(b.tvlUsd);
          case "volume":
            return parseFloat(b.volumeUsd);
          case "price":
            return priceOf(b);
        }
      })();
      return (av - bv) * dir;
    });
    return sorted;
  }, [pools, search, sortKey, sortDir, tab, watch]);

  return (
    <div className="space-y-6">
      {/* Hero + stats */}
      <PageHeader
        icon={Waves}
        title="Diesel Pools"
        description="Provide liquidity to earn a share of swap fees from every trade."
        stats={[
          { label: "Total Liquidity", value: fmtUsd(stats.tvl) },
          { label: "Pools",           value: fmt(stats.pools, 0) },
          { label: "Total Volume",    value: fmtUsd(stats.volume) },
          { label: "Swap Fee",        value: "0.25%" },
        ]}
        action={
          <CreatePoolDialog
            username={username}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Create pool
              </button>
            }
          />
        }
      />




      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60">
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
          All Pools
        </TabBtn>
        <TabBtn
          active={tab === "positions"}
          onClick={() => setTab("positions")}
        >
          My Positions
        </TabBtn>
        <TabBtn
          active={tab === "watchlist"}
          onClick={() => setTab("watchlist")}
        >
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
          placeholder="Search pools…"
          className="w-full rounded-xl border border-border/60 bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60 bg-card/20 overflow-hidden">
        {tab === "positions" ? (
          <PositionsTable
            username={username}
            pools={pools}
            positions={positions}
            loading={positionsLoading || isLoading}
          />
        ) : tab === "watchlist" && watch.size === 0 ? (
          <EmptyState
            title="Watchlist is empty"
            body="Tap the star next to any pool to add it to your watchlist."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/60 bg-card/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    Pair
                  </th>
                  <SortTh
                    label="TVL"
                    active={sortKey === "liquidity"}
                    dir={sortDir}
                    onClick={() => toggleSort("liquidity")}
                  />
                  <SortTh
                    label="Total Volume"
                    active={sortKey === "volume"}
                    dir={sortDir}
                    onClick={() => toggleSort("volume")}
                  />
                  <SortTh
                    label="Price"
                    active={sortKey === "price"}
                    dir={sortDir}
                    onClick={() => toggleSort("price")}
                  />
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    Watch
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
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
                        {Array.from({ length: 3 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted/30" />
                          </td>
                        ))}
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : visible.length === 0
                    ? (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState
                            title="No pools found"
                            body="Try a different search term."
                          />
                        </td>
                      </tr>
                    )
                    : visible.map((p) => (
                        <PoolRow
                          key={p.tokenPair}
                          pool={p}
                          watched={watch.has(p.tokenPair)}
                          onToggleWatch={() => toggleWatch(p.tokenPair)}
                        />
                      ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────



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

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 text-right">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground uppercase tracking-wider text-[11px] transition-colors hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3",
            active ? "opacity-100" : "opacity-40",
            active && dir === "asc" && "rotate-180",
          )}
        />
      </button>
    </th>
  );
}

function PoolRow({
  pool,
  watched,
  onToggleWatch,
}: {
  pool: Pool;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const tvl = parseFloat(pool.tvlUsd);
  const vol = parseFloat(pool.volumeUsd);
  const baseQty = parseFloat(pool.baseQuantity) || 0;
  const quoteQty = parseFloat(pool.quoteQuantity) || 0;
  const price = baseQty > 0 ? quoteQty / baseQty : parseFloat(pool.basePrice) || 0;

  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-accent/20">
      <td className="px-4 py-3">
        <Link
          to="/pool/$pair"
          params={{ pair: pool.tokenPair }}
          className="flex items-center gap-3 hover:opacity-80"
        >
          <PairIcons
            baseIcon={pool.baseIcon}
            quoteIcon={pool.quoteIcon}
            base={pool.base}
            quote={pool.quote}
          />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {pool.base}{" "}
              <span className="text-muted-foreground">/</span> {pool.quote}
            </p>
            <p className="text-[11px] text-muted-foreground">
              fee: 0.25%
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="font-mono font-medium text-foreground">
          {fmtUsd(tvl)}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {fmt(baseQty)} {pool.base}
        </p>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="font-mono font-medium text-foreground">
          {fmtUsd(vol)}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {fmt(parseFloat(pool.baseVolume))} {pool.base}
        </p>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="font-mono font-medium text-foreground">
          {price > 0 ? price.toFixed(price < 1 ? 6 : 4) : "—"}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {pool.quote} per {pool.base}
        </p>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onToggleWatch}
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded border border-transparent transition",
            watched
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <Star
            className={cn("size-3.5", watched && "fill-current")}
          />
        </button>
      </td>
    </tr>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Waves className="size-5" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function PositionsTable({
  username,
  pools,
  positions,
  loading,
}: {
  username: string;
  pools: Pool[] | undefined;
  positions: LiquidityPosition[] | undefined;
  loading: boolean;
}) {
  if (!username) {
    return (
      <EmptyState
        title="Sign in to view your positions"
        body="Connect your Hive account to see your LP positions across pools."
      />
    );
  }
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/60 bg-card/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Pair</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Your Share</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Pool Tokens</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Value</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-8 animate-pulse rounded-full bg-muted/30" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted/30" />
                  </div>
                </td>
                {Array.from({ length: 3 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted/30" />
                  </td>
                ))}
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const list = (positions ?? []).filter((p) => parseFloat(p.shares) > 0);
  if (list.length === 0) {
    return (
      <EmptyState
        title="No active positions"
        body="Add liquidity to a pool to see your LP position here."
      />
    );
  }
  const poolMap = new Map((pools ?? []).map((p) => [p.tokenPair, p]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border/60 bg-card/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Pair</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Your Share</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Pool Tokens</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Value</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((pos) => {
            const pool = poolMap.get(pos.tokenPair);
            const shares = parseFloat(pos.shares) || 0;
            const total = pool ? parseFloat(pool.totalShares) || 0 : 0;
            const pct = total > 0 ? shares / total : 0;
            const baseAmt = pool
              ? pct * (parseFloat(pool.baseQuantity) || 0)
              : 0;
            const quoteAmt = pool
              ? pct * (parseFloat(pool.quoteQuantity) || 0)
              : 0;
            const value = pool ? pct * (parseFloat(pool.tvlUsd) || 0) : 0;
            const [base, quote] = pos.tokenPair.split(":");

            return (
              <tr
                key={pos.tokenPair}
                className="border-b border-border/30 transition-colors hover:bg-accent/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PairIcons
                      baseIcon={pool?.baseIcon ?? null}
                      quoteIcon={pool?.quoteIcon ?? null}
                      base={base}
                      quote={quote}
                    />
                    <p className="font-semibold text-foreground">
                      {base} <span className="text-muted-foreground">/</span>{" "}
                      {quote}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono font-medium text-foreground">
                    {fmt(shares, 6)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {(pct * 100).toFixed(pct < 0.0001 ? 6 : 4)}% of pool
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-[12px] text-foreground">
                    {fmt(baseAmt, 4)} {base}
                  </p>
                  <p className="font-mono text-[12px] text-foreground">
                    {fmt(quoteAmt, 4)} {quote}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono font-medium text-foreground">
                    {fmtUsd(value)}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/pool/$pair"
                    params={{ pair: pos.tokenPair }}
                    className="inline-flex items-center gap-1 rounded border border-border/60 px-3 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-primary hover:text-primary"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
