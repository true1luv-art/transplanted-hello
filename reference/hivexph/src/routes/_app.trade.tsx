import { createFileRoute } from "@tanstack/react-router";
import { TradeClient } from "@/components/trade/trade-client";
import { getRouteApi } from "@tanstack/react-router";
const appRoute = getRouteApi("/_app");

export const Route = createFileRoute("/_app/trade")({
  head: () => ({
    meta: [
      { title: "Trade — HiveX PH" },
      {
        name: "description",
        content: "Trade Hive Engine tokens on the internal DEX.",
      },
    ],
  }),
  component: TradePage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function TradePage() {
  const { user } = appRoute.useLoaderData();
  const username = user.isLoggedIn ? user.username : null;
  return <TradeClient username={username} />;
}
