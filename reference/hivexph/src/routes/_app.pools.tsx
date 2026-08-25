import { createFileRoute } from "@tanstack/react-router";
import { PoolsClient } from "@/components/pools/pools-client";

export const Route = createFileRoute("/_app/pools")({
  head: () => ({
    meta: [
      { title: "AMM Pools — HiveX PH" },
      {
        name: "description",
        content:
          "Browse Hive Engine AMM liquidity pools — TVL, 24h volume, APR, and pricing.",
      },
    ],
  }),
  component: PoolsPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function PoolsPage() {
  return <PoolsClient />;
}

