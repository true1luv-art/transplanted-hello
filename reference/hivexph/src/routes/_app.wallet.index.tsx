import { createFileRoute, Navigate, getRouteApi } from "@tanstack/react-router";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

const appRoute = getRouteApi("/_app");

export const Route = createFileRoute("/_app/wallet/")({
  head: () => ({
    meta: [
      { title: "Wallet — HiveX PH" },
      {
        name: "description",
        content: "Your Hive Engine token balances on HiveX PH.",
      },
    ],
  }),
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: WalletRedirect,
});

function WalletRedirect() {
  const { user } = appRoute.useLoaderData();
  if (!user.isLoggedIn) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        Sign in to view your wallet.
      </div>
    );
  }
  return (
    <Navigate
      to="/wallet/$username"
      params={{ username: user.username }}
      replace
    />
  );
}
