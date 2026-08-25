import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import { LoginModal } from "@/components/login-modal";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { TokenHighlights } from "@/components/tokens/token-highlights";
import { DonateModal } from "@/components/donate-modal";
import { hiveAvatarUrl } from "@/lib/fetchers/hive-account-helpers";
import { ArrowUpRight, Code2, Gamepad2, Heart } from "lucide-react";
import multicoreLogo from "@/assets/multicore-logo.png.asset.json";
import idleRaidersLogo from "@/assets/idle-raiders-logo.png.asset.json";

const appRouteApi = getRouteApi("/_app");



export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "HiveX PH — Peer-to-peer HIVE trading" },
      {
        name: "description",
        content:
          "Trade HIVE directly with verified Filipino merchants. Non-custodial, PHP-priced offers, powered by Hive Keychain.",
      },
      { property: "og:title", content: "HiveX PH — Market Overview" },
      {
        property: "og:description",
        content:
          "Liquid P2P market for HIVE, HBD, and Hive layer-2 tokens.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: MarketDashboard,
});

function MarketDashboard() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="space-y-12">
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />

      {/* Hero */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
            Philippines · Non-custodial · Powered by Hive Keychain
          </span>
        </div>
        <h1 className="font-display text-5xl font-black tracking-tighter text-foreground md:text-7xl">
          Buy &amp; sell HIVE <br />
          <span className="text-primary">in pesos.</span>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Trade directly with verified Filipino merchants using GCash, Maya, or
          bank transfer. Coordinate via Facebook, Telegram, or Discord — zero
          platform fees, and your keys never leave your wallet.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => setLoginOpen(true)}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.35)] transition-all hover:bg-primary/90"
          >
            Sign in with Keychain
          </button>
          <Link
            to="/p2p"
            className="rounded-lg border border-border/60 bg-background px-6 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            Browse the market →
          </Link>
        </div>
      </div>


      {/* Token Highlights: Trending / Gainers / Losers */}
      <TokenHighlights />

      {/* Chart */}
      <ChartCard />

      {/* Merchants */}
      <MerchantSection />

      {/* Creator */}
      <CreatorSection />
    </div>
  );
}



function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[140px] rounded-2xl border border-border/60 bg-card p-4">
      <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

type Range = "1D" | "1W" | "1M";
const RANGE_DAYS: Record<Range, number> = { "1D": 1, "1W": 7, "1M": 30 };
type Currency = "USD" | "PHP";
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", PHP: "₱" };

function ChartCard() {
  const [range, setRange] = useState<Range>("1D");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [prices, setPrices] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(
      `https://api.coingecko.com/api/v3/coins/hive/market_chart?vs_currency=${currency.toLowerCase()}&days=${RANGE_DAYS[range]}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((d: { prices: [number, number][] }) => {
        if (!cancelled) {
          setPrices(d.prices ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range, currency]);

  const W = 1000;
  const H = 300;
  const values = prices.map((p) => p[1]);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const points = prices.map(([, v], i) => {
    const x = prices.length > 1 ? (i / (prices.length - 1)) * W : 0;
    const y = H - ((v - min) / span) * (H - 20) - 10;
    return [x, y] as const;
  });
  const linePath = points.length
    ? points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
    : "";
  const areaPath = linePath ? `${linePath} L ${W} ${H} L 0 ${H} Z` : "";

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const isUp = changePct >= 0;
  const colorClass = isUp ? "text-success" : "text-destructive";
  const rangeLabel = range === "1D" ? "Today" : range === "1W" ? "This Week" : "This Month";
  const sym = CURRENCY_SYMBOL[currency];
  const fmtPrice = (v: number) =>
    currency === "PHP"
      ? `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${sym}${v.toFixed(4)}`;

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-primary/20 to-muted/20 opacity-75 blur transition duration-1000 group-hover:opacity-100" />
      <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card shadow-2xl">
        <div className="flex flex-col justify-between gap-6 border-b border-border/40 bg-foreground/[0.02] p-6 md:flex-row md:items-end md:p-8">
          <div className="space-y-1">
            <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Pair
            </h2>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-foreground">HIVE / {currency}</span>
              <span className={`text-lg font-semibold ${colorClass}`}>
                {isUp ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </div>
            <p className="text-xl text-muted-foreground">
              {last > 0 ? fmtPrice(last) : "—"}
              <span className="ml-2 text-xs text-muted-foreground/70">{rangeLabel}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border/60 bg-background p-1">
              {(["USD", "PHP"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`cursor-pointer rounded-md px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                    c === currency
                      ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-border/60 bg-background p-1">
              {(["1D", "1W", "1M"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`cursor-pointer rounded-md px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                    r === range
                      ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative pt-8">
          <ChartSurface
            loading={loading}
            error={error}
            prices={prices}
            points={points}
            linePath={linePath}
            areaPath={areaPath}
            colorClass={colorClass}
            range={range}
            fmtPrice={fmtPrice}
            W={W}
            H={H}
          />
          <div className="pointer-events-none absolute bottom-4 left-6 font-mono text-[10px] font-bold uppercase text-muted-foreground/60">
            Live Stream Data v2.04
          </div>
        </div>
      </div>
    </div>
  );
}


function ChartSurface({
  loading,
  error,
  prices,
  points,
  linePath,
  areaPath,
  colorClass,
  range,
  fmtPrice,
  W,
  H,
}: {
  loading: boolean;
  error: boolean;
  prices: [number, number][];
  points: ReadonlyArray<readonly [number, number]>;
  linePath: string;
  areaPath: string;
  colorClass: string;
  range: Range;
  fmtPrice: (v: number) => string;
  W: number;
  H: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ idx: number; clientX: number } | null>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el || points.length === 0) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, relX / rect.width));
    const idx = Math.round(ratio * (points.length - 1));
    setHover({ idx, clientX: relX });
  };

  const active = hover && prices[hover.idx];
  const activePoint = hover && points[hover.idx];
  const tipLeftPct = activePoint ? (activePoint[0] / W) * 100 : 0;
  const tipTopPct = activePoint ? (activePoint[1] / H) * 100 : 0;
  const dateFmt = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: range === "1D" ? "2-digit" : undefined,
      minute: range === "1D" ? "2-digit" : undefined,
    });

  return (
    <div
      ref={wrapRef}
      className="relative h-64 w-full"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Loading chart…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 grid place-items-center text-xs text-destructive">
          Failed to load market data.
        </div>
      )}
      {!loading && !error && linePath && (
        <>
          <svg
            className={`h-full w-full ${colorClass}`}
            viewBox={`0 0 ${W} ${H}`}
            fill="none"
            preserveAspectRatio="none"
          >
            <path d={areaPath} fill="currentColor" fillOpacity={0.08} />
            <path
              d={linePath}
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {activePoint && (
              <>
                <line
                  x1={activePoint[0]}
                  x2={activePoint[0]}
                  y1={0}
                  y2={H}
                  stroke="currentColor"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activePoint[0]}
                  cy={activePoint[1]}
                  r={5}
                  fill="currentColor"
                />
              </>
            )}
          </svg>
          {active && activePoint && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
              style={{
                left: `${Math.min(95, Math.max(5, tipLeftPct))}%`,
                top: `${tipTopPct}%`,
              }}
            >
              <div className="font-mono text-sm font-bold text-foreground">
                {fmtPrice(active[1])}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {dateFmt(active[0])}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}





const MERCHANTS = [
  {
    name: "BlockMaster",
    initials: "BM",
    grad: "from-rose-500 to-amber-500",
    rating: "98.5% (2,450 orders)",
    methods: ["Binance Pay", "Zelle"],
    price: "0.241 USD",
    available: "12,000 HIVE",
    limit: "$50.00 - $3,000.00",
  },
  {
    name: "HiveExchange",
    initials: "HX",
    grad: "from-blue-500 to-purple-500",
    rating: "100% (450 orders)",
    methods: ["Revolut"],
    price: "0.242 USD",
    available: "4,500 HIVE",
    limit: "$20.00 - $1,100.00",
  },
  {
    name: "SwiftLiquidity",
    initials: "SL",
    grad: "from-emerald-500 to-cyan-500",
    rating: "99.2% (1,820 orders)",
    methods: ["Bank Transfer", "Wise"],
    price: "0.243 USD",
    available: "8,200 HIVE",
    limit: "$100.00 - $5,000.00",
  },
];

const CREATOR_PROJECTS = [
  {
    name: "Multicore",
    tagline: "Terracore Automation Bot",
    description:
      "An open-source multi-account browser dashboard and automation toolkit for the Terracore blockchain game. Automatically claims SCRAP, runs quests, attacks targets, and trades on the relic market entirely client-side with local encrypted keys.",
    url: "https://multicore-app.vercel.app/",
    initials: "MC",
    icon: Code2,
    grad: "from-fuchsia-500 to-indigo-500",
    logo: multicoreLogo.url,
    logoBg: "bg-[#1a0d2e]",
  },
  {
    name: "Idle Raiders",
    tagline: "RPG Idle Raiding Game",
    description:
      "An idle RPG raiding and card progression game built on Hive. Manage squad lineups, accumulate materials from dungeon expeditions, counter mission fatigue with Mastery stats, and level up cards to defeat bosses.",
    url: "https://www.idleraiders.site/",
    initials: "IR",
    icon: Gamepad2,
    grad: "from-amber-500 to-rose-500",
    logo: idleRaidersLogo.url,
    logoBg: "bg-[#2a1810]",
  },
];

function CreatorSection() {
  const { user } = appRouteApi.useLoaderData();
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-primary" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
              Meet the builder
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold text-foreground">
            Crafted by an indie Hive dev
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One developer, a few side projects, and a love for the Hive ecosystem.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Creator card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-6">
          <div
            aria-hidden
            className="absolute -right-12 -top-12 size-44 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="relative flex items-start gap-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-primary/40">
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-tr from-primary to-primary/40 font-mono text-sm font-bold text-primary-foreground">
                RJ
              </div>
              <img
                src={hiveAvatarUrl("rhiaji")}
                alt="@rhiaji"
                className="absolute inset-0 size-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-foreground">@rhiaji</div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                Full-stack · Hive builder
              </div>
            </div>
          </div>

          <p className="relative mt-5 text-sm leading-relaxed text-muted-foreground">
            HiveX PH is a solo passion project — built to make trading HIVE in
            pesos painless for the Filipino community. Always tinkering on tools
            that make Hive feel more like home.
          </p>

          <div className="relative mt-6 flex flex-wrap items-center gap-2">
            <DonateModal recipient="hivexph" user={user}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground transition hover:bg-primary/90"
              >
                <Heart className="size-3.5 fill-current" />
                Support the work
              </button>
            </DonateModal>
            <a
              href="https://peakd.com/@rhiaji"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              View on Hive
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>

        {/* Projects */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CREATOR_PROJECTS.map((p) => {
            return (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="mb-4 flex items-start justify-between">
                <div
                  className={`grid size-11 place-items-center overflow-hidden rounded-xl ${p.logoBg} shadow-lg ring-1 ring-border/40`}
                >
                  <img
                    src={p.logo}
                    alt={`${p.name} logo`}
                    className="size-full object-contain p-1"
                    loading="lazy"
                  />
                </div>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="text-base font-bold text-foreground">{p.name}</div>
                <div className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {p.tagline}
                </div>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Side project
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-primary">
                    {new URL(p.url).hostname.replace("www.", "")}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MerchantSection() {
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Top Rated Merchants</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified partners with high liquidity.
          </p>
        </div>
        <Link
          to="/p2p"
          className="group flex items-center gap-2 text-sm font-bold tracking-tight text-primary transition-colors hover:text-primary/80"
        >
          VIEW ALL ORDERS
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MERCHANTS.map((m, i) => {
          const filled = [4, 4, 2][i] ?? 3;
          return (
            <Link
              key={m.name}
              to="/p2p"
              className="group block rounded-xl border border-border/40 bg-card p-5 transition-all hover:border-primary/40"
            >
              <div className="mb-4 flex items-center justify-between">
                <div
                  className={`grid size-10 place-items-center rounded-lg bg-gradient-to-tr ${m.grad} text-sm font-bold text-white transition-colors`}
                >
                  {m.initials}
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`size-1 rounded-full ${
                        idx < filled ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="font-bold text-foreground">{m.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m.rating}</div>
              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
                <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground/70">
                  Limit
                </span>
                <span className="text-xs font-medium text-foreground">{m.limit}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground/70">
                  Price
                </span>
                <span className="font-mono text-xs font-medium text-foreground">{m.price}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

