import { createFileRoute } from "@tanstack/react-router";

import { PortfolioView } from "@/components/pages/PortfolioView";
import { normalizeHiveUsername } from "@/lib/chain/identity";

export const Route = createFileRoute("/@{$username}/nfts")({
  head: ({ params }) => {
    const name = normalizeHiveUsername(params.username);
    const title = `@${name} — NFT portfolio | HiveX NFTs`;
    const description = `NFTs owned by @${name}: items, active listings and estimated value on HiveX NFTs.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: UserNftsPage,
});

function UserNftsPage() {
  const { username } = Route.useParams();
  return <PortfolioView username={username} />;
}
