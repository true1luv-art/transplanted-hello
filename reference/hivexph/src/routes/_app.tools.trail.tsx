import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Users, Shield, Sparkles, Info, ExternalLink, KeyRound, MousePointerClick, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const appRouteApi = getRouteApi("/_app");

const TRAIL_LEADER = "hivexph.voter";
const HIVE_VOTE_URL = "https://hive.vote";
const HIVE_VOTE_TRAIL_URL = `https://hive.vote/dash.php?i=1&trail=${TRAIL_LEADER}`;

export const Route = createFileRoute("/_app/tools/trail")({
  head: () => ({
    meta: [
      { title: "Curation Trail — HiveX Tools" },
      {
        name: "description",
        content: `Follow the @${TRAIL_LEADER} curation trail on Hive.vote and earn curation rewards automatically.`,
      },
    ],
  }),
  component: CurationTrail,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function CurationTrail() {
  const { user } = appRouteApi.useLoaderData();

  const steps = [
    {
      icon: ExternalLink,
      title: "Go to Hive.vote",
      body: (
        <>
          Open{" "}
          <a
            href={HIVE_VOTE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            hive.vote
          </a>{" "}
          — a third-party automation service made by Hive Witness @mahdiyari.
        </>
      ),
    },
    {
      icon: KeyRound,
      title: "Login with Hivesigner",
      body: (
        <>
          Sign in once using your Hive username. You'll grant <span className="font-mono">@steemauto</span>{" "}
          posting authority — it can only upvote, post, and claim rewards. It cannot touch your balance.
        </>
      ),
    },
    {
      icon: MousePointerClick,
      title: "Open Curation Trail",
      body: "From the dashboard sidebar, choose Curation Trail.",
    },
    {
      icon: UserPlus,
      title: `Search and follow @${TRAIL_LEADER}`,
      body: (
        <>
          Search for <span className="font-mono font-semibold text-foreground">{TRAIL_LEADER}</span>, click{" "}
          <span className="font-semibold">Follow</span>, then set your preferred voting weight (we suggest 50–100%).
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Curation Trail"
        description={`Mirror the votes of @${TRAIL_LEADER} automatically through Hive.vote and earn curation rewards on every Filipino post we upvote.`}
        stats={[
          { label: "TRAIL LEADER", value: `@${TRAIL_LEADER}` },
          { label: "POWERED BY", value: "Hive.vote" },
          { label: "SETUP TIME", value: "~2 min" },
        ]}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card className="border-border/60 bg-card/40 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Follow the @{TRAIL_LEADER} trail
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  HiveX uses Hive.vote to run its curation trail. Follow these four quick steps below.
                </p>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">External Tool</Badge>
            </div>

            <ol className="mt-6 space-y-4">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <li
                    key={idx}
                    className="flex gap-4 rounded-lg border border-border/40 bg-background/40 p-4"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-muted-foreground">
                          STEP {idx + 1}
                        </span>
                        <h3 className="font-display text-sm font-semibold text-foreground">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                <a href={HIVE_VOTE_TRAIL_URL} target="_blank" rel="noreferrer">
                  Open Hive.vote
                  <ExternalLink className="ml-2 size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="sm:w-48">
                <a href="https://hive.vote/faq.php" target="_blank" rel="noreferrer">
                  Read Hive.vote FAQ
                </a>
              </Button>
            </div>
          </Card>

          <Card className="border-border/60 bg-card/40 p-6">
            <h3 className="font-display text-base font-semibold text-foreground">
              Why follow the HiveX trail?
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Shield className="size-4 text-primary" /> Maximize Curation Rewards
                </h4>
                <p className="text-xs text-muted-foreground">
                  Our curation team manually screens and votes on high-quality Filipino posts, ensuring optimal curation APR.
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-primary" /> Set-and-Forget
                </h4>
                <p className="text-xs text-muted-foreground">
                  Once you've followed the trail on Hive.vote, your account will mirror every @{TRAIL_LEADER} upvote automatically.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/40 p-6">
            <h3 className="font-display text-base font-bold text-foreground">Your Account</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <span className="text-xs text-muted-foreground">Signed in as</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {user?.isLoggedIn ? `@${user.username}` : "Not connected"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <span className="text-xs text-muted-foreground">Trail leader</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  @{TRAIL_LEADER}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vote weight</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  Set on Hive.vote
                </span>
              </div>
            </div>
          </Card>

          <Alert className="border-primary/20 bg-primary/5">
            <Info className="size-4 text-primary" />
            <AlertTitle className="text-xs font-semibold text-primary">Heads up</AlertTitle>
            <AlertDescription className="text-[11px] text-primary/80">
              Hive.vote only needs your <span className="font-semibold">posting</span> authority. Keep your voting mana above 80% for the best curation APR.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
