import { createFileRoute, useNavigate, getRouteApi } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { WalletClient } from "@/components/wallet/wallet-client";

const appRoute = getRouteApi("/_app");

type TabSearch = "lp" | "nft" | "history" | undefined;
const URL_TO_TAB: Record<string, string> = { lp: "lps", nft: "nfts", history: "history" };
const TAB_TO_URL: Record<string, TabSearch> = { tokens: undefined, lps: "lp", nfts: "nft", history: "history" };

export const Route = createFileRoute("/_app/wallet/$username")({
  validateSearch: (search: Record<string, unknown>): { tab?: TabSearch } => {
    const t = search.tab;
    if (t === "lp" || t === "nft" || t === "history") return { tab: t };
    return {};
  },
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username}'s Wallet — HiveX PH` },
      {
        name: "description",
        content: `Hive Engine token balances for @${params.username}.`,
      },
    ],
  }),
  component: WalletUserPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function WalletUserPage() {
  const { username } = Route.useParams();
  const { tab: urlTab } = Route.useSearch();
  const { user: viewer } = appRoute.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });

  const activeTab = urlTab ? URL_TO_TAB[urlTab] ?? "tokens" : "tokens";

  const handleTabChange = (next: string) => {
    const nextUrl = TAB_TO_URL[next];
    navigate({ search: nextUrl ? { tab: nextUrl } : {}, replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="MARKET"
        title={`@${username}'s Wallet`}
        description={`Hive Engine token balances for @${username}, sorted by portfolio value.`}
      />
      <WalletClient
        username={username}
        viewerUsername={viewer.isLoggedIn ? viewer.username : undefined}
        tab={activeTab}
        onTabChange={handleTabChange}
      />
    </>
  );
}
