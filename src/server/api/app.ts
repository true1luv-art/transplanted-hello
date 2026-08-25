import { ensureReady } from "./lib/bootstrap";
import { corsMiddleware } from "./middleware/cors";
import { requestLoggerMiddleware } from "./middleware/request-logger";
import { createApiRouter } from "./routes";
import { fail, json } from "./lib/respond";
import { notFound } from "./lib/errors";

export function createApp() {
  const router = createApiRouter();

  return async function handleRequest(request: Request): Promise<Response> {
    return requestLoggerMiddleware(request, async () => {
      return corsMiddleware(request, async () => {
        try {
          await ensureReady();

          const url = new URL(request.url);
          const segments = url.pathname.split("/").filter(Boolean);

          // All API routes are under /api/<path>. The first segment is always "api".
          if (segments[0] !== "api") {
            return json(
              {
                ok: true,
                message: "HiveX API server",
                docs: "Use /api/health to verify status.",
              },
              200,
            );
          }

          const method = request.method;
          const path = "/" + segments.slice(1).join("/");

          const match = router.match(method, path);
          if (!match) {
            return fail(notFound(`Unknown path: ${path}`));
          }

          const response = await match.handler({
            request,
            url,
            params: match.params,
            query: url.searchParams,
          });
          return response;
        } catch (error) {
          return fail(error);
        }
      });
    });
  };
}

export type AppHandler = ReturnType<typeof createApp>;
