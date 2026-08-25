import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  Sparkles,
  Waves,
  Megaphone,
  UserPlus,
  Gift,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { HIVE_CONFIG } from "@/lib/config/api";
import { hiveAvatarUrl } from "@/lib/fetchers/hive-account-helpers";
import { fetchEngineStats, HIVEX_VOTER_ACCOUNT } from "@/lib/fetchers/tools";

export const Route = createFileRoute("/_app/tools/")({
  head: () => ({
    meta: [
      { title: "HiveX Tools — Growth engine for the HiveX PH community" },
      {
        name: "description",
        content:
          "Delegate HP, promote posts, create Hive accounts, and earn HIVEX rewards — all powered by @hivexph.voter.",
      },
    ],
  }),
  component: ToolsDashboard,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

type ToolCard = {
  to: string;
  label: string;
  description: string;
  icon: typeof Wrench;
  status: "live" | "soon";
};

const TOOLS: ToolCard[] = [
  {
    to: "/tools/accounts",
    label: "Create Hive Account",
    description: "Mint a brand-new Hive account using a HiveX-funded ACT.",
    icon: UserPlus,
    status: "live",
  },
  {
    to: "/tools/delegate",
    label: "Delegate HP",
    description: "Power the engine, earn HIVEX rewards every cycle.",
    icon: Waves,
    status: "live",
  },
  {
    to: "/tools/promote",
    label: "Promote a Post",
    description: "Burn HIVEX, get a @hivexph.voter upvote on your post.",
    icon: Megaphone,
    status: "live",
  },
  {
    to: "/tools/trail",
    label: "Curation Trail",
    description: "Follow the HiveX voter trail with adjustable weight.",
    icon: Users,
    status: "live",
  },
  {
    to: "/tools/rewards",
    label: "My Rewards",
    description: "Claim your share of HIVEX revenue from the engine.",
    icon: Gift,
    status: "live",
  },
];

function ToolsDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["tools-engine-stats", HIVEX_VOTER_ACCOUNT],
    queryFn: fetchEngineStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const placeholder = isLoading ? "…" : "—";
  const stats = [
    {
      label: "DELEGATED HP",
      value: data ? `${fmt(data.delegatedHp, 0)} HP` : placeholder,
    },
    {
      label: "ACT AVAILABLE",
      value: data ? fmt(data.actAvailable, 0) : placeholder,
    },
    {
      label: "RC",
      value: data ? `${data.rcPct.toFixed(1)}%` : placeholder,
    },
    {
      label: "TREASURY HIVE",
      value: data ? fmt(data.hive, 0) : placeholder,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wrench}
        title="HiveX Tools"
        description={`Growth engine powered by @${HIVEX_VOTER_ACCOUNT}. Delegate, promote, create accounts, earn.`}
        stats={stats}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3" />
              {data?.source === "backend" ? "Live" : "Demo Preview"}
            </Badge>
            <a
              href={`${HIVE_CONFIG.peakdUrl}/@${HIVEX_VOTER_ACCOUNT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              @{HIVEX_VOTER_ACCOUNT}
            </a>
          </div>
        }
      />

      <Card className="overflow-hidden border-border/60 bg-card/40 p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex shrink-0 items-center gap-4">
            <div className="relative size-16 overflow-hidden rounded-2xl border border-border bg-card">
              <img
                src={hiveAvatarUrl(HIVEX_VOTER_ACCOUNT)}
                alt={`@${HIVEX_VOTER_ACCOUNT}`}
                className="size-full object-cover"
              />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-foreground">
                @{HIVEX_VOTER_ACCOUNT}
              </p>
              <p className="text-xs text-muted-foreground">
                Treasury account for the HiveX PH growth engine
              </p>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="font-display text-base font-semibold text-foreground">
              One account. One engine. Many tools.
            </h2>
            <p className="text-sm text-muted-foreground">
              HP delegations fuel RC, which mints ACTs for new Hive accounts. HIVEX
              burns pay for promotion, featured listings, and other services. A
              share of every burn flows back to delegators as rewards.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="block transition-all duration-200 hover:-translate-y-1"
            >
              <Card
                className="h-full border-border/60 bg-card/40 p-5 opacity-90 hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card">
                    <Icon className="size-5 text-foreground" />
                  </div>
                  {tool.status === "soon" ? (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      Soon
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] uppercase tracking-wider">Live</Badge>
                  )}
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                  {tool.label}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}