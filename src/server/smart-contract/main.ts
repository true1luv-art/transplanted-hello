/**
 * server/smart-contract/main.ts
 *
 * Entry point for the smart-contract worker process.
 *   npm run server:smart-contract
 *
 * Lifecycle (mirrors the reference worker):
 *   load configuration -> connect MongoDB -> initialize chain access ->
 *   log queue depth -> start polling -> graceful stop on SIGTERM/SIGINT.
 *
 * Runs as an independent Node process: it claims pending transactions with a
 * lease, so it is safe next to the inline drain performed by the API.
 * No React, no Zustand, no browser APIs are reachable from here.
 */
import { config } from "@/lib/config/config";
import { closeDatabase } from "@/lib/config/database";
import { checkHiveConnection } from "@/lib/chain/hive";
import { ensureSeeded } from "@/server/scripts/seed";
import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { workerLogger as log } from "./lib/logger";
import { getWorker } from "./workers/transaction-worker";

async function logQueueDepth(): Promise<void> {
  const [pending, processing, failed] = await Promise.all([
    transactionsPendingRepository.count({ status: "pending" }),
    transactionsPendingRepository.count({ status: "processing" }),
    transactionsPendingRepository.count({ status: "failed" }),
  ]);
  log.info("queue depth", { pending, processing, failed });
}

async function main(): Promise<void> {
  log.info("starting smart-contract worker", {
    database: config.databaseName,
    blockchainDriver: config.blockchainDriver,
    pollIntervalMs: config.smartContractInterval,
    maxAttempts: config.smartContractMaxAttempts,
  });

  await ensureSeeded();
  log.info("database ready");

  if (config.blockchainDriver === "hive") {
    const hive = await checkHiveConnection();
    log.info("hive connectivity", { ...hive });
    if (!hive.connected) log.warn("hive RPC unreachable — verification will retry");
  } else {
    log.info("blockchain driver is mock — Hive verification is skipped");
  }

  await logQueueDepth().catch((error: unknown) => {
    log.warn("could not log queue depth", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const worker = getWorker();
  worker.start();
  log.info(`worker ${worker.id} watching transactions_pending`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received — stopping worker`);
    worker.stop();
    await worker.waitForIdle(5_000);
    await closeDatabase();
    log.info("shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((error) => {
  log.error("fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
