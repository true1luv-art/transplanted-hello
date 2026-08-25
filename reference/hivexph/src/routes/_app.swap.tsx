import { createFileRoute } from "@tanstack/react-router";
import { SwapClient } from "@/components/swap/swap-client";
import { getRouteApi } from "@tanstack/react-router";
const appRoute = getRouteApi("/_app");

export const Route = createFileRoute("/_app/swap")({
  head: () => ({
    meta: [
      { title: "Swap — HiveX PH" },
      {
        name: "description",
        content:
          "Swap Hive Engine tokens using on-chain AMM liquidity pools.",
      },
    ],
  }),
  component: SwapPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function SwapPage() {
  const { user } = appRoute.useLoaderData();
  const username = user.isLoggedIn ? user.username : null;
  return <SwapClient username={username} />;
}
