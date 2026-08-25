/**
 * Mock Hive Keychain.
 *
 * Phase 2.5 boundary: marketplace operations (list / buy / cancel / transfer)
 * are DIRECT user-signed actions — they never touch the platform transaction
 * queue. Every direct action must be authorized here first, exactly like the
 * real Keychain browser extension would prompt the user.
 *
 * Phase 3 swaps this class for `HiveKeychainService` behind the same interface.
 */
import { config } from "@/lib/config/config";
import { logger } from "@/lib/config/logger";

export type KeychainOutcome = "approve" | "reject";

export interface KeychainRequest {
  account: string;
  /** Human readable operation label shown in the prompt. */
  operation: string;
  /** Optional HIVE amount involved in the operation. */
  amount?: number | undefined;
  memo?: string | undefined;
}

export interface KeychainApproval {
  approved: true;
  account: string;
  /** Mock signature; Phase 3 returns the real Keychain signature. */
  signature: string;
  signedAt: string;
  mock: boolean;
}

export class KeychainRejectedError extends Error {
  readonly code = "KEYCHAIN_REJECTED";
  constructor(message = "Transaction was rejected in Hive Keychain") {
    super(message);
    this.name = "KeychainRejectedError";
  }
}

export interface KeychainService {
  requestSignature(request: KeychainRequest): Promise<KeychainApproval>;
}

function mockSignature(): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `SIG-${out}`;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class MockKeychainService implements KeychainService {
  constructor(private outcome: KeychainOutcome = config.keychain.defaultOutcome) {}

  /** Test hook: force the next prompts to approve or reject. */
  setOutcome(outcome: KeychainOutcome) {
    this.outcome = outcome;
  }

  async requestSignature(request: KeychainRequest): Promise<KeychainApproval> {
    if (config.keychain.latency > 0) await wait(config.keychain.latency);

    if (this.outcome === "reject") {
      logger.warn("KEYCHAIN", `@${request.account} rejected ${request.operation}`);
      throw new KeychainRejectedError();
    }

    logger.info("KEYCHAIN", `@${request.account} approved ${request.operation}`, {
      amount: request.amount,
      memo: request.memo,
    });

    return {
      approved: true,
      account: request.account,
      signature: mockSignature(),
      signedAt: new Date().toISOString(),
      mock: true,
    };
  }
}

let instance: KeychainService | null = null;

export function getKeychainService(): KeychainService {
  if (!instance) instance = new MockKeychainService();
  return instance;
}

/** Test/di hook. */
export function setKeychainService(service: KeychainService) {
  instance = service;
}
