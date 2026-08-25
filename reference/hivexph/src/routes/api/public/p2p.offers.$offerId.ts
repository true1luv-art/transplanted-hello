import { createFileRoute } from "@tanstack/react-router";
import { getOfferById } from "@/lib/fetchers/p2p";

export const Route = createFileRoute("/api/public/p2p/offers/$offerId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { offerId } = params;
        if (!offerId || !/^.+-(buy|sell)-\d+$/.test(offerId)) {
          return Response.json(
            {
              error:
                "Invalid offerId format. Expected: {merchant}-{buy|sell}-{index}",
            },
            { status: 400 },
          );
        }
        try {
          const offer = await getOfferById(offerId);
          if (!offer) {
            return Response.json(
              { error: "Offer not found or no longer active." },
              { status: 404 },
            );
          }
          return Response.json(
            { offer },
            {
              headers: {
                "Cache-Control":
                  "public, s-maxage=30, stale-while-revalidate=60",
              },
            },
          );
        } catch (err) {
          console.error(
            `[api/public/p2p/offers/${offerId}] failed:`,
            err,
          );
          return Response.json(
            { error: "Failed to fetch offer from the Hive blockchain." },
            { status: 500 },
          );
        }
      },
    },
  },
});
