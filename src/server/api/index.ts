import { createServer } from "http";
import { config } from "@/lib/config/config";
import { logger } from "./lib/logger";
import { createApp } from "./app";

async function main() {
  const handler = createApp();
  const server = createServer(async (req, res) => {
    // Convert Node IncomingMessage to a Web Request-like shape.
    const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    const body = req.method !== "GET" && req.method !== "HEAD" ? await readBody(req) : null;
    const request = new Request(url, {
      method: req.method ?? "GET",
      headers,
      body: body && body.length > 0 ? (Uint8Array.from(body) as unknown as BodyInit) : null,
    });

    try {
      const response = await handler(request);
      res.statusCode = response.status;
      for (const [key, value] of response.headers.entries()) {
        res.setHeader(key, value);
      }
      const responseBody = await response.text();
      res.end(responseBody);
    } catch (error) {
      logger.error("API", "Unhandled server error", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { code: "INTERNAL", message: "Unexpected server error" } }));
    }
  });

  server.listen(config.apiPort, () => {
    logger.info("API", `HiveX API server listening on http://localhost:${config.apiPort}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("API", "SIGTERM received, shutting down");
    server.close(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    logger.info("API", "SIGINT received, shutting down");
    server.close(() => process.exit(0));
  });
}

function readBody(req: import("http").IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

main().catch((error) => {
  logger.error("API", "Failed to start API server", error);
  process.exit(1);
});
