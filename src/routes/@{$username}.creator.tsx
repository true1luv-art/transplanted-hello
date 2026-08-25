import { createFileRoute } from "@tanstack/react-router";

import { CreatorView } from "@/components/pages/CreatorView";
import { normalizeHiveUsername } from "@/lib/chain/identity";

export const Route = createFileRoute("/@{$username}/creator")({
  head: ({ params }) => {
    const name = normalizeHiveUsername(params.username);
    const title = `@${name} — Creator profile | HiveX NFTs`;
    const description = `Collections launched by @${name} on HiveX NFTs: mint progress, revenue and holders.`;
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
  component: UserCreatorPage,
});

function UserCreatorPage() {
  const { username } = Route.useParams();
  return <CreatorView username={username} />;
}
