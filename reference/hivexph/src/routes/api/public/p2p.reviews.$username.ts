import { createFileRoute } from "@tanstack/react-router";
import { fetchMerchantReviews } from "@/lib/fetchers/p2p";
import {
  parseHiveContacts,
  getHiveAccount,
  discoverMerchantPermlink,
} from "@/lib/fetchers/hive-account-helpers";

export const Route = createFileRoute("/api/public/p2p/reviews/$username")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { username } = params;
        let permlink: string | null = null;
        try {
          const account = await getHiveAccount(username);
          if (account) {
            const contacts = parseHiveContacts(account);
            const url = contacts.merchant_account?.trim() ?? "";
            if (url) {
              const match = url.match(/@[^/]+\/([^/?#]+)/);
              if (match?.[1]) permlink = match[1];
            }
          }
        } catch {
          /* fall through */
        }
        if (!permlink) {
          permlink = await discoverMerchantPermlink(username);
        }
        if (!permlink) permlink = "merchant-application";

        const reviews = await fetchMerchantReviews(username, permlink);
        return Response.json(
          { reviews, permlink },
          {
            headers: {
              "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
            },
          },
        );
      },
    },
  },
});
