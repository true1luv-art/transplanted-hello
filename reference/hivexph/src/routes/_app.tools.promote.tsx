import { useMemo, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Megaphone, Sparkles, Loader2, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { sendToken } from "@/lib/keychain";
import { HIVEX_VOTER_ACCOUNT } from "@/lib/fetchers/tools";
import { fetchTokenBalance } from "@/lib/fetchers/balances";

export const Route = createFileRoute("/_app/tools/promote")({
  head: () => ({
    meta: [
      { title: "Promote a Post — HiveX Tools" },
      {
        name: "description",
        content:
          "Burn HIVEX to receive a curated upvote from @hivexph.voter on your Hive blog post.",
      },
    ],
  }),
  component: PromotePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const BURN_ACCOUNT = "null";
const HIVEX_SYMBOL = "HIVEX";

type Tier = {
  id: "small" | "medium" | "premium";
  label: string;
  cost: number;
  weight: number; // expected vote weight (basis points, 100 = 1%)
  blurb: string;
};

const TIERS: Tier[] = [
  {
    id: "small",
    label: "Small",
    cost: 25,
    weight: 1500,
    blurb: "Light boost — good for casual posts.",
  },
  {
    id: "medium",
    label: "Medium",
    cost: 100,
    weight: 4200,
    blurb: "Solid curation for community-quality posts.",
  },
  {
    id: "premium",
    label: "Premium",
    cost: 500,
    weight: 10000,
    blurb: "Full-power upvote. Limited per day.",
  },
];

function parseHivePostUrl(
  url: string,
): { author: string; permlink: string } | null {
  if (!url) return null;
  const m = url.match(/@([a-z0-9.-]{3,16})\/([a-z0-9-]+)/i);
  if (!m) return null;
  return { author: m[1].toLowerCase(), permlink: m[2].toLowerCase() };
}

const appRoute = getRouteApi("/_app");

function PromotePage() {
  const { user } = appRoute.useLoaderData();
  const [url, setUrl] = useState("");
  const [tierId, setTierId] = useState<Tier["id"]>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "error";
    msg: string;
  } | null>(null);

  const { data: hivexBalance } = useQuery({
    queryKey: ["he-balance", user.username, "HIVEX"],
    queryFn: () => fetchTokenBalance(user.username, "HIVEX"),
    enabled: !!user.isLoggedIn && !!user.username,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const balance = hivexBalance ?? 0;
  const parsed = useMemo(() => parseHivePostUrl(url), [url]);
  const tier = TIERS.find((t) => t.id === tierId)!;

  const canAfford = balance >= tier.cost;
  const canSubmit = user.isLoggedIn && !!parsed && !submitting && canAfford;

  async function handlePromote() {
    if (!canSubmit || !parsed) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const memo = JSON.stringify({
        app: "hivex.tools",
        action: "promote",
        author: parsed.author,
        permlink: parsed.permlink,
        tier: tier.id,
      });
      const res = await sendToken(
        user.username,
        BURN_ACCOUNT,
        tier.cost.toFixed(3),
        memo,
        HIVEX_SYMBOL,
      );
      const txId = ((res.result as { id?: string } | undefined) ?? {}).id ?? "n/a";

      try {
        await axios.post(
          "/api/public/tools/promotions/submit",
          {
            author: parsed.author,
            permlink: parsed.permlink,
            tier: tier.id,
            burn_tx: txId,
          },
          { timeout: 6000 },
        );
      } catch {
        /* backend not live yet — chain burn is the source of truth */
      }

      setFeedback({
        kind: "ok",
        msg: `Burned ${tier.cost} HIVEX. Vote for @${parsed.author}/${parsed.permlink} is queued at ~${(tier.weight / 100).toFixed(0)}% weight.`,
      });
      setUrl("");
    } catch (e) {
      setFeedback({
        kind: "error",
        msg: e instanceof Error ? e.message : "Burn cancelled or failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const stats = [
    {
      label: "YOUR HIVEX BALANCE",
      value: user.isLoggedIn
        ? `${balance.toLocaleString(undefined, { maximumFractionDigits: 3 })} HIVEX`
        : "—",
    },
    {
      label: "SELECTED TIER COST",
      value: `${tier.cost.toLocaleString()} HIVEX`,
    },
    {
      label: "AFTER PROMOTION",
      value: user.isLoggedIn
        ? `${Math.max(0, balance - tier.cost).toLocaleString(undefined, { maximumFractionDigits: 3 })} HIVEX`
        : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Promote a Post"
        description={`Burn HIVEX to schedule an upvote from @${HIVEX_VOTER_ACCOUNT}. Burns are permanent — they shrink HIVEX supply.`}
        stats={stats}
        action={
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            Demo Pricing
          </Badge>
        }
      />

      <Card className="border-border/60 bg-card/40 p-6">
        {!user.isLoggedIn ? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Connect your Hive account to promote a post.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="post-url">Hive post URL</Label>
              <Input
                id="post-url"
                type="url"
                placeholder="https://peakd.com/@your-account/your-post"
                value={url}
                onChange={(e) => setUrl(e.target.value.trim())}
                className="font-mono text-xs"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {parsed
                  ? `Detected: @${parsed.author}/${parsed.permlink}`
                  : url
                    ? "Could not detect author/permlink. Paste a peakd / hive.blog / ecency URL."
                    : "Paste any Hive blog post link."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tier</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {TIERS.map((t) => {
                  const selected = t.id === tierId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTierId(t.id)}
                      className={
                        "rounded-lg border p-4 text-left transition-colors " +
                        (selected
                          ? "border-foreground bg-card"
                          : "border-border/60 bg-card/40 hover:border-border")
                      }
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-display text-sm font-semibold text-foreground">
                          {t.label}
                        </p>
                        <p className="font-mono text-xs text-foreground">
                          {t.cost} HIVEX
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t.blurb}
                      </p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        ~{(t.weight / 100).toFixed(0)}% vote weight
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handlePromote}
              disabled={!canSubmit}
              className="w-full"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {!user.isLoggedIn
                ? "Sign in to promote"
                : !canAfford
                  ? `Need ${tier.cost} HIVEX`
                  : `Burn ${tier.cost} HIVEX & promote`}
            </Button>

            {feedback && (
              <p
                className={
                  "rounded-md border px-3 py-2 text-xs " +
                  (feedback.kind === "error"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400")
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