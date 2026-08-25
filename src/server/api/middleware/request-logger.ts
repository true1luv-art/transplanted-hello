import { logger } from "../lib/logger";

export function requestLoggerMiddleware(
  request: Request,
  handler: () => Response | Promise<Response>,
): Promise<Response> {
  const start = Date.now();
  const url = new URL(request.url);
  return Promise.resolve(handler()).then((response) => {
    const duration = Date.now() - start;
    logger.info(
      "API",
      `${request.method} ${url.pathname} ${response.status} ${duration}ms`,
    );
    return response;
  });
}
