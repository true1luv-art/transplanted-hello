import { MockBlockchainService } from "@/features/mocks/mock-blockchain.service";
import { config } from "@/lib/config/config";
import { logger } from "@/lib/config/logger";
import { HiveBlockchainService } from "./hive-blockchain.service";
import type { BlockchainService } from "./blockchain.service";

/**
 * Blockchain service factory.
 *
 * BLOCKCHAIN_DRIVER=mock (default) -> MockBlockchainService
 * BLOCKCHAIN_DRIVER=hive           -> HiveBlockchainService -> lib/chain/hive.ts
 *
 * The frontend never reaches this factory; it stays mock-based regardless.
 */
let instance: BlockchainService | null = null;

export function createBlockchainService(
  driver: typeof config.blockchainDriver = config.blockchainDriver,
): BlockchainService {
  if (driver === "hive") {
    logger.info("BLOCKCHAIN:HIVE", "Using real Hive blockchain service");
    return new HiveBlockchainService();
  }
  return new MockBlockchainService();
}

export function getBlockchainService(): BlockchainService {
  if (!instance) instance = createBlockchainService();
  return instance;
}

/** Test/di hook. */
export function setBlockchainService(service: BlockchainService) {
  instance = service;
}

/** Test/di hook — forces the factory to re-read configuration. */
export function resetBlockchainService() {
  instance = null;
}

export type { BlockchainService } from "./blockchain.service";
export { MockBlockchainService } from "@/features/mocks/mock-blockchain.service";
export { HiveBlockchainService } from "./hive-blockchain.service";
export { SmartContractWorker, getWorker } from "./workers/transaction-worker";
export { PermanentError, TerminalTransactionError, TransientTransactionError } from "./lib/errors";
export { HiveVerificationService, verifyHiveTransaction } from "./services/verification.service";
