import { createFileRoute } from "@tanstack/react-router";
import { fetchLiveOffers } from "@/lib/fetchers/p2p";

export const Route = createFileRoute("/api/public/p2p/offers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const side = url.searchParams.get("side") as "buy" | "sell" | null;
        const token = url.searchParams.get("token");
        const payment = url.searchParams.get("payment");
        const limitParam = url.searchParams.get("limit");
        const historyLimit = limitParam
          ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 500)
          : 100;

        try {
          let offers = await fetchLiveOffers(historyLimit);
          if (side) offers = offers.filter((o) => o.side === side);
          if (token) offers = offers.filter((o) => o.token === token);
          if (payment)
            offers = offers.filter((o) =>
              o.paymentMethods.some(
                (pm) => pm.toLowerCase() === payment.toLowerCase(),
              ),
            );
          return Response.json(
            {
              offers,
              count: offers.length,
              scanned_at: new Date().toISOString(),
            },
            {
              headers: {
                "Cache-Control":
                  "public, s-maxage=30, stale-while-revalidate=60",
              },
            },
          );
        } catch (err) {
          console.error("[api/public/p2p/offers] failed:", err);
          return Response.json(
            { error: "Failed to fetch offers from the Hive blockchain." },
            { status: 500 },
          );
        }
      },
    },
  },
});
