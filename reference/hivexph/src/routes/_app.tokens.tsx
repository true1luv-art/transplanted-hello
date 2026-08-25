import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { TokensClient } from "@/components/tokens/tokens-client";

const appRoute = getRouteApi("/_app");

export const Route = createFileRoute("/_app/tokens")({
  head: () => ({
    meta: [
      { title: "Tokens — HiveX PH" },
      {
        name: "description",
        content:
          "Browse all Hive Engine tokens ranked by 24h trading volume.",
      },
    ],
  }),
  component: TokensPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function TokensPage() {
  const { user } = appRoute.useLoaderData();
  return (
    <TokensClient
      username={user.username}
      isLoggedIn={user.isLoggedIn}
    />
  );
}
