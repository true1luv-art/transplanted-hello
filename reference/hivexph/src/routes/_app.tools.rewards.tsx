import { useState } from "react";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Gift, Sparkles, Loader2, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { HIVE_CONFIG } from "@/lib/config/api";
import { HIVEX_VOTER_ACCOUNT } from "@/lib/fetchers/tools";

export const Route = createFileRoute("/_app/tools/rewards")({
  head: () => ({
    meta: [
      { title: "My Rewards — HiveX Tools" },
      {
        name: "description",
        content:
          "Track your share of HIVEX engine revenue and claim rewards earned from delegating HP to @hivexph.voter.",
      },
    ],
  }),
  component: RewardsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

/** Demo APR until the engine publishes the real rate. */
const ESTIMATED_APR = 0.185;
/** Placeholder HIVEX per HIVE; replaced by oracle later. */
const HIVEX_PER_HIVE = 1.0;

const appRoute = getRouteApi("/_app");

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.split(" ")[0]) || 0;
}

interface DelegationSummary {
  hp: number;
}

async function fetchDelegationSummary(
  delegator: string,
): Promise<DelegationSummary> {
  const [delegations, gpo] = await Promise.all([
    axios.post<{
      result: Array<{ delegatee: string; vesting_shares: string }>;
    }>(HIVE_CONFIG.apiUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "condenser_api.get_vesting_delegations",
      params: [delegator, "", 1000],
    }),
    axios.post<{
      result: { total_vesting_fund_hive: string; total_vesting_shares: string };
    }>(HIVE_CONFIG.apiUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "condenser_api.get_dynamic_global_properties",
      params: [],
    }),
  ]);

  const row = (delegations.data.result ?? []).find(
    (r) => r.delegatee === HIVEX_VOTER_ACCOUNT,
  );
  const vests = row ? parseAmount(row.vesting_shares) : 0;
  const fundHive = parseAmount(gpo.data.result?.total_vesting_fund_hive);
  const totalVests = parseAmount(gpo.data.result?.total_vesting_shares);
  const hp = totalVests > 0 ? (vests * fundHive) / totalVests : 0;
  return { hp };
}

function fmt(n: number, digits = 3): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function RewardsPage() {
  const { user } = appRoute.useLoaderData();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error" | "info";
    msg: string;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-delegation-summary", user.username],
    queryFn: () => fetchDelegationSummary(user.username),
    enabled: !!user.isLoggedIn && !!user.username,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });

  const hp = data?.hp ?? 0;
  // Naive monthly estimate; the real number comes from the backend once live.
  const monthlyHive = (hp * ESTIMATED_APR) / 12;
  const monthlyHivex = monthlyHive * HIVEX_PER_HIVE;
  // Estimated accrued = roughly 30 days at the current rate (placeholder).
  const estimatedClaimable = monthlyHivex;

  async function handleClaim() {
    if (!user.isLoggedIn || claiming) return;
    setClaiming(true);
    setFeedback(null);
    try {
      const res = await axios.post(
        "/api/public/tools/rewards/claim",
        { delegator: user.username },
        { timeout: 8000 },
      );
      if (res.data?.ok) {
        setFeedback({
          kind: "ok",
          msg: `Claimed ${res.data.amount_hivex} HIVEX (tx ${res.data.tx_id ?? "n/a"}).`,
        });
      } else {
        setFeedback({
          kind: "info",
          msg: "Rewards engine isn't live yet — your delegation is tracked on-chain. Claims will open once the backend ships.",
        });
      }
    } catch {
      setFeedback({
        kind: "info",
        msg: "Rewards engine isn't live yet — your delegation is tracked on-chain. Claims will open once the backend ships.",
      });
    } finally {
      setClaiming(false);
      queryClient.invalidateQueries({ queryKey: ["my-delegation-summary"] });
    }
  }

  const stats = [
    {
      label: "MY DELEGATION",
      value: user.isLoggedIn
        ? isLoading
          ? "…"
          : `${Math.round(hp).toLocaleString()} HP`
        : "—",
    },
    {
      label: "EST. CLAIMABLE",
      value: user.isLoggedIn ? `${fmt(estimatedClaimable, 3)} HIVEX` : "—",
    },
    { label: "APR", value: `${(ESTIMATED_APR * 100).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gift}
        title="My Rewards"
        description={`A share of every HIVEX burn returns to delegators. Power @${HIVEX_VOTER_ACCOUNT} with HP, claim HIVEX here.`}
        stats={stats}
        action={
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            Estimated
          </Badge>
        }
      />

      <Card className="border-border/60 bg-card/40 p-6">
        {!user.isLoggedIn ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Connect your Hive account to view rewards.
          </div>
        ) : hp <= 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You have no active HP delegation to @{HIVEX_VOTER_ACCOUNT}.
              Delegate to start earning a share of HIVEX engine revenue.
            </p>
            <Button asChild>
              <Link to="/tools/delegate">Delegate HP</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="DELEGATED" value={`${Math.round(hp).toLocaleString()} HP`} />
              <Stat label="EST. MONTHLY" value={`${fmt(monthlyHivex, 3)} HIVEX`} />
              <Stat label="APR" value={`${(ESTIMATED_APR * 100).toFixed(1)}%`} />
            </div>

            <div className="rounded-lg border border-border/60 bg-card/40 p-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Claimable balance
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-foreground">
                {fmt(estimatedClaimable, 3)}{" "}
                <span className="text-base text-muted-foreground">HIVEX</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Estimated from your delegation × APR ÷ 12. Real-time accrual
                lights up once the engine publishes payouts.
              </p>
            </div>

            <Button onClick={handleClaim} disabled={claiming} className="w-full">
              {claiming && <Loader2 className="size-4 animate-spin" />}
              Claim rewards
            </Button>

            {feedback && (
              <p
                className={
                  "rounded-md border px-3 py-2 text-xs " +
                  (feedback.kind === "error"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : feedback.kind === "ok"
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border/60 bg-card/60 text-muted-foreground")
                }
              >
                {feedback.msg}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}