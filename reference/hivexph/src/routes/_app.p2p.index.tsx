import { createFileRoute, Link } from "@tanstack/react-router";
import P2PPageClient from "@/components/p2p/p2p-client";
import { getRouteApi } from "@tanstack/react-router";
const appRoute = getRouteApi("/_app");
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/p2p/")({
  head: () => ({
    meta: [
      { title: "P2P Offers — HiveX PH" },
      {
        name: "description",
        content:
          "Browse peer-to-peer crypto offers on Hive. Trade HIVE, HBD, and Hive Engine tokens directly with merchants.",
      },
      { property: "og:title", content: "P2P Offers — HiveX PH" },
      {
        property: "og:description",
        content:
          "Browse peer-to-peer crypto offers and trade directly with merchants on Hive.",
      },
    ],
  }),
  component: P2pRoute,
  errorComponent: P2pError,
  notFoundComponent: P2pNotFound,
});

function P2pRoute() {
  const { user } = appRoute.useLoaderData();
  return (
    <P2PPageClient username={user.username} isLoggedIn={user.isLoggedIn} />
  );
}

function P2pError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Something went wrong loading P2P
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {error.message}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

function P2pNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
      <Button asChild className="mt-6">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
