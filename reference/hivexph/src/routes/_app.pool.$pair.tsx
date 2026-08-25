import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import useSWR from "swr";
import { ArrowLeft, Users, Wallet, Waves, Plus, Minus } from "lucide-react";
import {
  fetchPools,
  fetchPoolLiquidityPositions,
  type Pool,
  type LiquidityPosition,
} from "@/lib/fetchers/pools";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { AddLiquidityDialog } from "@/components/pools/add-liquidity-dialog";
import { RemoveLiquidityDialog } from "@/components/pools/remove-liquidity-dialog";

const appRoute = getRouteApi("/_app");

export const Route = createFileRoute("/_app/pool/$pair")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.pair} Pool — HiveX PH` },
      {
        name: "description",
        content: `Hive Engine AMM pool stats for ${params.pair}: TVL, reserves, 24h volume, total shares, contributors, and your liquidity position.`,
      },
    ],
  }),
  component: PoolDetailPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Pool not found</p>
  ),
});

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtCompact(n: number, d = 2): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(d)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(d)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(d)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

function fmtUsd(n: number): string {
  if (!isFinite(n) || isNaN(n) || n === 0) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(2)}`;
}


function fmtNum(n: number, d = 6): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

// ── page ─────────────────────────────────────────────────────────────────────
function PoolDetailPage() {
  const { pair } = Route.useParams();
  const { user } = appRoute.useLoaderData();
  const username = user?.username ?? "";

  const { data: pools, isLoading } = useSWR<Pool[]>(
    ["pools"],
    () => fetchPools(),
    { revalidateOnFocus: false, refreshInterval: 60_000, dedupingInterval: 30_000 },
  );

  const { data: contributors, isLoading: contributorsLoading } = useSWR<LiquidityPosition[]>(
    ["poolPositions", pair],
    () => fetchPoolLiquidityPositions(pair, 200),
    { revalidateOnFocus: false, refreshInterval: 60_000 },
  );

  const pool = pools?.find((p) => p.tokenPair === pair) ?? null;

  return (
    <div className="space-y-6">
      {isLoading && !pool ? (
        <LoadingSkeleton />
      ) : !pool ? (
        <>
          <Link
            to="/pools"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to pools
          </Link>
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="font-mono text-sm text-muted-foreground">
              No pool found for <span className="text-foreground">{pair}</span>
            </p>
          </div>
        </>
      ) : (
        <PoolDetail
          pool={pool}
          contributors={contributors ?? null}
          contributorsLoading={contributorsLoading}
          username={username}
        />
      )}
    </div>
  );
}

function PoolDetail({
  pool,
  contributors,
  contributorsLoading,
  username,
}: {
  pool: Pool;
  contributors: LiquidityPosition[] | null;
  contributorsLoading: boolean;
  username: string;
}) {
  const tvlUsd = parseFloat(pool.tvlUsd);
  const volUsd = parseFloat(pool.volumeUsd);
  const baseQty = parseFloat(pool.baseQuantity);
  const quoteQty = parseFloat(pool.quoteQuantity);
  const totalShares = parseFloat(pool.totalShares);

  const myPosition = username
    ? contributors?.find((p) => p.account === username) ?? null
    : null;
  const myShares = myPosition ? parseFloat(myPosition.shares) : 0;
  const mySharePct = totalShares > 0 ? (myShares / totalShares) * 100 : 0;
  const myBase = totalShares > 0 ? (myShares / totalShares) * baseQty : 0;
  const myQuote = totalShares > 0 ? (myShares / totalShares) * quoteQty : 0;
  const myValueUsd = totalShares > 0 && tvlUsd > 0 ? (myShares / totalShares) * tvlUsd : 0;


  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const hasPosition = myShares > 0;

  return (
    <>
      <PageHeader
        icon={Waves}
        title={`${pool.base} / ${pool.quote}`}
        description={`Diesel pool created by @${pool.creator}`}
        stats={[
          { label: "Liquidity", value: fmtUsd(tvlUsd) },
          { label: "24h Volume", value: fmtUsd(volUsd) },
          { label: `${pool.base} Reserve`, value: fmtCompact(baseQty) },
          { label: `${pool.quote} Reserve`, value: fmtCompact(quoteQty) },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/pools"
              className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              <ArrowLeft className="size-4" />
              Back to pools
            </Link>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={!username}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" />
              Add liquidity
            </button>
            {username && hasPosition && (
              <button
                type="button"
                onClick={() => setRemoveOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
              >
                <Minus className="size-4" />
                Remove liquidity
              </button>
            )}
          </div>
        }
      />

      {username && (
        <AddLiquidityDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          pool={pool}
          username={username}
        />
      )}
      {username && hasPosition && (
        <RemoveLiquidityDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          pool={pool}
          username={username}
          myShares={myShares}
        />
      )}



      {/* Your Position */}
      {username && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">
              Your Position
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground">@{username}</span>
          </div>
          {contributorsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !myPosition ? (
            <p className="font-mono text-[12px] text-muted-foreground">
              You don't have any liquidity in this pool yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Pool Share" value={`${mySharePct.toFixed(mySharePct < 0.01 ? 4 : 2)}%`} />
              <MiniStat label="Value" value={fmtUsd(myValueUsd)} />
              <MiniStat label={pool.base} value={fmtNum(myBase, 6)} />
              <MiniStat label={pool.quote} value={fmtNum(myQuote, 6)} />
              <MiniStat label="LP Shares" value={fmtNum(myShares, 6)} />
            </div>
          )}
        </div>
      )}


      {/* Contributors */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border/60 bg-card/20 shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {contributors && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                {contributors.length}
              </span>
            )}
            <Users className="size-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold text-foreground">Contributors</h3>

          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="font-mono text-sm font-semibold text-foreground">
              {fmtCompact(totalShares)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Shares
            </span>
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur">
              <tr className="border-b border-border/60">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Account
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Share
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Shares (LP)
                </th>
              </tr>
            </thead>
            <tbody>
              {contributorsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="size-7 rounded-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-3 w-12" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-3 w-24" />
                    </td>
                  </tr>
                ))
              ) : !contributors || contributors.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <Users className="size-8 text-muted-foreground/40" />
                      <p className="text-[13px] text-muted-foreground">
                        No liquidity positions found
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                contributors.map((p) => {
                  const sharesNum = parseFloat(p.shares) || 0;
                  const sharePct = totalShares > 0 ? (sharesNum / totalShares) * 100 : 0;
                  const isMe = p.account === username;
                  return (
                    <tr
                      key={p.account}
                      className={
                        "border-b border-border/30 transition-colors hover:bg-accent/30 " +
                        (isMe ? "bg-primary/5" : "")
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img
                            src={`https://images.hive.blog/u/${p.account}/avatar`}
                            alt={p.account}
                            width={28}
                            height={28}
                            className="size-7 flex-shrink-0 rounded-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                          <Link
                            to="/profile/$username"
                            params={{ username: p.account }}
                            className="truncate font-mono font-medium text-foreground hover:text-primary"
                          >
                            @{p.account}
                          </Link>
                          {isMe && (
                            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
                              you
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {sharePct.toFixed(sharePct < 0.01 ? 4 : 2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {fmtNum(sharesNum, 4)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[17px] font-semibold text-foreground break-all">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[14px] font-semibold text-foreground break-all">
        {value}
      </p>
    </div>
  );
}


function LoadingSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div>
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
