import { createFileRoute } from "@tanstack/react-router";
import { getOffersActivation } from "@/lib/fetchers/p2p";

export const Route = createFileRoute("/api/public/p2p/activation/$username")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { username } = params;
        if (!username || !/^[a-z0-9.-]{3,16}$/.test(username)) {
          return Response.json(
            { error: "Invalid or missing Hive username." },
            { status: 400 },
          );
        }
        try {
          const activation = await getOffersActivation(username);
          if (!activation) {
            return Response.json(
              { username, active: false },
              {
                headers: {
                  "Cache-Control":
                    "public, s-maxage=30, stale-while-revalidate=60",
                },
              },
            );
          }
          const nowSec = Math.floor(Date.now() / 1000);
          const expiresIn = Math.max(0, activation.time_ended - nowSec);
          return Response.json(
            {
              username,
              active: true,
              time_started: activation.time_started,
              time_ended: activation.time_ended,
              expires_in: expiresIn,
            },
            {
              headers: {
                "Cache-Control":
                  "public, s-maxage=30, stale-while-revalidate=60",
              },
            },
          );
        } catch (err) {
          console.error(
            `[api/public/p2p/activation/${username}] failed:`,
            err,
          );
          return Response.json(
            {
              error:
                "Failed to check activation status on the Hive blockchain.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
