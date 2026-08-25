import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Rocket, Snowflake } from "lucide-react";
import {
  useApi,
  fetchTokens,
  fetchTokenSparklines,
  type TokenRow,
  type SparklineMap,
} from "@/hooks/useAxios";

type HighlightTab = "trending" | "gainers" | "losers";

const TAB_CONFIG: Record<HighlightTab, { label: string; icon: typeof Flame; accent: string }> = {
  trending: { label: "Trending", icon: Flame, accent: "text-orange-400" },
  gainers: { label: "Gainers", icon: Rocket, accent: "text-emerald-400" },
  losers: { label: "Losers", icon: Snowflake, accent: "text-rose-400" },
};

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

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return <div className="h-full w-full" aria-hidden />;
  const W = 100;
  const H = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = W / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, H - ((v - min) / range) * H] as const);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  const stroke = positive ? "rgb(52 211 153)" : "rgb(251 113 133)";
  const fillId = `spark-fill-${positive ? "p" : "n"}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function TokenHighlights({
  tokens: tokensProp,
  isLoading: isLoadingProp,
}: {
  tokens?: TokenRow[];
  isLoading?: boolean;
} = {}) {
  const shouldFetch = tokensProp === undefined;
  const { data: fetched, isLoading: fetchedLoading } = useApi<TokenRow[]>(
    shouldFetch ? ["tokens", fetchTokens] : null,
    { refreshInterval: 60_000 },
  );
  const tokens = tokensProp ?? fetched;
  const isLoading = isLoadingProp ?? fetchedLoading;

  const [tab, setTab] = useState<HighlightTab>("trending");

  const items = useMemo(() => {
    if (!tokens) return [];
    const withVol = tokens.filter((t) => parseFloat(t.volume) > 0);
    const sorters: Record<HighlightTab, (a: TokenRow, b: TokenRow) => number> = {
      trending: (a, b) => parseFloat(b.volume) - parseFloat(a.volume),
      gainers: (a, b) => parseFloat(b.priceChangePercent.replace("%", "")) - parseFloat(a.priceChangePercent.replace("%", "")),
      losers: (a, b) => parseFloat(a.priceChangePercent.replace("%", "")) - parseFloat(b.priceChangePercent.replace("%", "")),
    };
    const pool = tab === "trending" ? withVol : withVol.length ? withVol : tokens;
    return [...pool].sort(sorters[tab]).slice(0, 10);
  }, [tokens, tab]);

  const symbolsKey = items.map((t) => t.symbol).join(",");
  const { data: sparklines } = useApi<SparklineMap>(
    items.length ? [`sparklines:${symbolsKey}`, () => fetchTokenSparklines(items.map((t) => t.symbol))] : null,
    { refreshInterval: 300_000, revalidateOnFocus: false, dedupingInterval: 120_000 },
  );

  const renderCard = (token: TokenRow, i: number, keyPrefix: string) => {
    const pct = fmtPct(token.priceChangePercent);
    const spark = sparklines?.[token.symbol] ?? [];
    return (
      <Link
        key={`${keyPrefix}-${token.symbol}`}
        to={`/trade?symbol=${token.symbol}`}
        className="group flex w-[230px] flex-shrink-0 flex-col gap-2 rounded-lg border border-border/40 bg-muted/30 p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {token.icon ? (
              <img
                src={token.icon}
                alt={token.symbol}
                width={28}
                height={28}
                className="size-7 flex-shrink-0 rounded-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] font-bold text-muted-foreground">
                {token.symbol.slice(0, 2)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-mono text-[13px] font-semibold leading-tight text-foreground">
                {token.symbol}
              </p>
              <p className="truncate text-[10px] leading-tight text-muted-foreground">
                {token.name}
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground shrink-0">#{i + 1}</span>
        </div>

        <div className="h-10 w-full">
          <Sparkline data={spark} positive={pct.positive} />
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[13px] text-foreground">
              {fmtNum(token.lastPrice, 6)} HIVE
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {fmtUsd(token.lastPriceUsd)}
            </p>
          </div>
          <span
            className={cn(
              "font-mono text-[12px] font-semibold whitespace-nowrap",
              pct.positive ? "text-emerald-400" : "text-rose-400",
            )}
          >
            {pct.text}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">(24h)</span>
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="rounded-lg p-3">
      <div className="mb-3 flex items-center gap-1.5">
        {(Object.keys(TAB_CONFIG) as HighlightTab[]).map((key) => {
          const cfg = TAB_CONFIG[key];
          const Icon = cfg.icon;
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider transition-colors",
                active
                  ? "border-border bg-muted text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-3.5", active && cfg.accent)} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
        {isLoading || items.length === 0 ? (
          <div className="flex gap-3 pb-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex w-[230px] flex-shrink-0 flex-col gap-2 rounded-md border border-border/40 bg-muted/30 p-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-8 w-full" />
                <Skeleton className="mt-1 h-3 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex w-max gap-3 pb-1 animate-[marquee_40s_linear_infinite] group-hover:[animation-play-state:paused]"
          >
            {items.map((t, i) => renderCard(t, i, "a"))}
            {items.map((t, i) => renderCard(t, i, "b"))}
          </div>
        )}
      </div>
    </div>
  );
}
