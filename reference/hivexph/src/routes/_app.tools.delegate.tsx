import { useMemo, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Waves, Sparkles, Loader2, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { HIVE_CONFIG } from "@/lib/config/api";
import { broadcast } from "@/lib/keychain";
import { fetchEngineStats, HIVEX_VOTER_ACCOUNT } from "@/lib/fetchers/tools";

export const Route = createFileRoute("/_app/tools/delegate")({
  head: () => ({
    meta: [
      { title: "Delegate HP — HiveX Tools" },
      {
        name: "description",
        content:
          "Delegate Hive Power to @hivexph.voter and earn HIVEX rewards as the engine generates RC, mints ACTs, and burns HIVEX for services.",
      },
    ],
  }),
  component: DelegatePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const PRESETS = [100, 500, 1_000, 5_000, 10_000];
/** Demo APR until the backend publishes the real number. */
const ESTIMATED_APR = 0.185;
/** HIVEX market price in HIVE — placeholder until oracle is wired. */
const HIVEX_PER_HIVE = 1.0;

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.split(" ")[0]) || 0;
}

interface VestConversion {
  hivePerVest: number;
}

async function fetchVestConversion(): Promise<VestConversion> {
  const { data } = await axios.post<{
    result: { total_vesting_fund_hive: string; total_vesting_shares: string };
  }>(HIVE_CONFIG.apiUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "condenser_api.get_dynamic_global_properties",
    params: [],
  });
  const fundHive = parseAmount(data.result?.total_vesting_fund_hive);
  const totalVests = parseAmount(data.result?.total_vesting_shares);
  return { hivePerVest: totalVests > 0 ? fundHive / totalVests : 0 };
}

interface MyDelegation {
  vests: number;
  hp: number;
}

async function fetchMyDelegation(
  delegator: string,
  hivePerVest: number,
): Promise<MyDelegation> {
  const { data } = await axios.post<{
    result: Array<{ delegatee: string; vesting_shares: string }>;
  }>(HIVE_CONFIG.apiUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "condenser_api.get_vesting_delegations",
    params: [delegator, "", 1000],
  });
  const row = (data.result ?? []).find((r) => r.delegatee === HIVEX_VOTER_ACCOUNT);
  const vests = row ? parseAmount(row.vesting_shares) : 0;
  return { vests, hp: vests * hivePerVest };
}

const appRoute = getRouteApi("/_app");

function fmt(n: number, digits = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function DelegatePage() {
  const { user } = appRoute.useLoaderData();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error" | "info";
    msg: string;
  } | null>(null);

  const { data: vest } = useQuery({
    queryKey: ["hive-vest-conversion"],
    queryFn: fetchVestConversion,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { data: engine } = useQuery({
    queryKey: ["tools-engine-stats", HIVEX_VOTER_ACCOUNT],
    queryFn: fetchEngineStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: myDelegation, isLoading: loadingMine } = useQuery({
    queryKey: ["my-hp-delegation", user.username, vest?.hivePerVest],
    queryFn: () => fetchMyDelegation(user.username, vest!.hivePerVest),
    enabled: !!user.isLoggedIn && !!user.username && !!vest?.hivePerVest,
    staleTime: 30_000,
  });

  const hpNum = useMemo(() => parseFloat(amount) || 0, [amount]);

  const expectedMonthlyHive = (hpNum * ESTIMATED_APR) / 12;
  const expectedMonthlyHivex = expectedMonthlyHive * HIVEX_PER_HIVE;

  const canSubmit =
    user.isLoggedIn && hpNum > 0 && !!vest?.hivePerVest && !submitting;

  async function handleDelegate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const vests = hpNum / vest!.hivePerVest;
      const vestingShares = `${vests.toFixed(6)} VESTS`;
      const res = await broadcast(
        user.username,
        [
          [
            "delegate_vesting_shares",
            {
              delegator: user.username,
              delegatee: HIVEX_VOTER_ACCOUNT,
              vesting_shares: vestingShares,
            },
          ],
        ],
        "Active",
      );
      const txId =
        ((res.result as { id?: string } | undefined) ?? {}).id ?? "n/a";

      // Best-effort backend notification. If the endpoint isn't live yet we
      // still treat the on-chain delegation as the source of truth.
      try {
        await axios.post(
          "/api/public/tools/delegations/record",
          {
            delegator: user.username,
            vests: vestingShares,
            tx_id: txId,
          },
          { timeout: 6000 },
        );
      } catch {
        /* backend not live yet — silent */
      }

      setFeedback({
        kind: "ok",
        msg: `Delegation broadcast — ${fmt(hpNum, 3)} HP to @${HIVEX_VOTER_ACCOUNT}. Rewards accrue from the next cycle.`,
      });
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["my-hp-delegation"] });
    } catch (e) {
      setFeedback({
        kind: "error",
        msg: e instanceof Error ? e.message : "Delegation cancelled or failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUndelegate() {
    if (!user.isLoggedIn || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await broadcast(
        user.username,
        [
          [
            "delegate_vesting_shares",
            {
              delegator: user.username,
              delegatee: HIVEX_VOTER_ACCOUNT,
              vesting_shares: "0.000000 VESTS",
            },
          ],
        ],
        "Active",
      );
      setFeedback({
        kind: "info",
        msg: "Undelegation submitted. HP returns after the 5-day cool-down.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-hp-delegation"] });
    } catch (e) {
      setFeedback({
        kind: "error",
        msg: e instanceof Error ? e.message : "Undelegation cancelled.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const stats = [
    {
      label: "MY DELEGATION",
      value: user.isLoggedIn
        ? loadingMine
          ? "…"
          : `${fmt(myDelegation?.hp ?? 0, 0)} HP`
        : "—",
    },
    { label: "APR", value: `${(ESTIMATED_APR * 100).toFixed(1)}%` },
    {
      label: "ENGINE HP",
      value: engine ? `${fmt(engine.delegatedHp, 0)} HP` : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Waves}
        title="Delegate HP"
        description={`Power the engine. HP delegations to @${HIVEX_VOTER_ACCOUNT} generate RC, ACTs, and curation — a share of HIVEX revenue flows back to you.`}
        stats={stats}
        action={
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            Demo APR
          </Badge>
        }
      />

      <Card className="border-border/60 bg-card/40 p-6">
        {!user.isLoggedIn ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Connect your Hive account to delegate HP. Use the wallet button at
            the top right.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hp-amount">Amount to delegate (HP)</Label>
              <Input
                id="hp-amount"
                inputMode="decimal"
                placeholder="0.000"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                className="font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAmount(String(p))}
                  >
                    {p.toLocaleString()} HP
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="EST. MONTHLY"
                value={hpNum > 0 ? `${fmt(expectedMonthlyHive, 3)} HIVE` : "—"}
              />
              <Stat
                label="EST. HIVEX / MO"
                value={hpNum > 0 ? `${fmt(expectedMonthlyHivex, 3)}` : "—"}
              />
              <Stat label="APR" value={`${(ESTIMATED_APR * 100).toFixed(1)}%`} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleDelegate}
                disabled={!canSubmit}
                className="flex-1"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Delegate {hpNum > 0 ? `${fmt(hpNum, 0)} HP` : ""}
              </Button>
              {!!(myDelegation && myDelegation.hp > 0) && (
                <Button
                  variant="outline"
                  onClick={handleUndelegate}
                  disabled={submitting}
                >
                  Undelegate all
                </Button>
              )}
            </div>

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/40 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            01 · Delegate
          </p>
          <h3 className="mt-2 font-display text-sm font-semibold text-foreground">
            Your HP fuels the engine
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Keychain signs a `delegate_vesting_shares` op. You stay in
            control — undelegate anytime.
          </p>
        </Card>
        <Card className="border-border/60 bg-card/40 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            02 · Engine works
          </p>
          <h3 className="mt-2 font-display text-sm font-semibold text-foreground">
            RC → ACTs → Accounts; Votes → Promotion
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            HiveX uses your HP to mint accounts and curate posts. Services pay
            in HIVEX, part of which is burned.
          </p>
        </Card>
        <Card className="border-border/60 bg-card/40 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            03 · Earn
          </p>
          <h3 className="mt-2 font-display text-sm font-semibold text-foreground">
            Claim HIVEX rewards
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Each cycle your share is recorded. Claim from the Rewards page once
            it ships.
          </p>
        </Card>
      </div>
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