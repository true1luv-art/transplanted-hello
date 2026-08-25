/**
 * server/game-smart-contract/index.ts
 *
 * Entry point for the settlement worker process.
 * Start: `npx tsx server/game-smart-contract/index.ts`
 *
 * Reads from environment (via lib/config/config.ts):
 *   MONGODB_URI        — MongoDB connection string (required)
 *   TREASURY_ADDRESS   — treasury wallet that receives deposits
 *   TREASURY_KEY       — treasury secret key (base58) used for payouts
 *   CONTRACT_ADDRESS   — SPL mint address of the game token
 *   WORKER_POLL_MS     — drain interval in ms (default 5000)
 *   WORKER_MAX_RETRIES — transient-failure retry ceiling (default 8)
 *
 * OPERATIONAL CONSTRAINT: run exactly ONE instance so settlement stays
 * sequential and oldest-first. Multiple instances will cause duplicate payouts.
 * SERVER-ONLY — never imported by the Next.js app.
 */

import "dotenv/config";
import { connectDatabase } from "@/lib/config/database";
import { config } from "@/lib/config/config";
import { TransactionWorker, logQueueDepth } from "./workers/transaction-worker";
import { sendOnChain } from "./lib/transfers";
import { logger } from "./lib/logger";

function shutdown(worker: TransactionWorker, signal: string): void {
  logger.info(`${signal} received — stopping worker`);
  worker.stop();
  // Give in-flight DB writes a moment to finish before exiting.
  setTimeout(() => process.exit(0), 500);
}

async function main(): Promise<void> {
  logger.info(`starting on chain=${config.blockchain.chain}`);

  await connectDatabase();
  logger.info("MongoDB connected");

  await logQueueDepth().catch((err: unknown) => {
    logger.warn("could not log queue depth", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const worker = new TransactionWorker(sendOnChain);

  process.on("SIGTERM", () => shutdown(worker, "SIGTERM"));
  process.on("SIGINT", () => shutdown(worker, "SIGINT"));

  worker.start();
}

main().catch((err: unknown) => {
  logger.error("fatal startup error", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
