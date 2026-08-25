/**
 * server/smart-contract/lib/errors.ts
 *
 * Failure taxonomy for the smart-contract worker.
 *
 * TERMINAL  — retrying can never help (wrong sender, wrong amount, sold out…).
 *             The transaction is dead-lettered immediately: a `failed` receipt
 *             is written and the pending document is removed.
 * TRANSIENT — the environment failed (RPC down, network, node lag). The
 *             transaction returns to the queue until `SMART_CONTRACT_MAX_ATTEMPTS`.
 *
 * SERVER-ONLY.
 */

/** Codes that must never be retried. */
export const TERMINAL_CODES = new Set<string>([
  "VALIDATION_FAILED",
  "INVALID_TRANSACTION_ID",
  "MISSING_HIVE_TRANSACTION_ID",
  "WRONG_SENDER",
  "WRONG_RECIPIENT",
  "WRONG_AMOUNT",
  "WRONG_SYMBOL",
  "WRONG_MEMO",
  "WRONG_OPERATION",
  "OPERATION_NOT_FOUND",
  "UNSUPPORTED_TRANSACTION_TYPE",
  "INSUFFICIENT_BALANCE",
  "NOT_FOUND",
  "SOLD_OUT",
  "EXPIRED_REQUEST",
]);

/** Codes that describe an environment failure and should be retried. */
export const TRANSIENT_CODES = new Set<string>([
  "RPC_FAILURE",
  "NOT_CONFIRMED",
  "TRANSACTION_NOT_FOUND",
  "MALFORMED_RESPONSE",
  "NETWORK_ERROR",
]);

/** Permanent, business-rule failure — never retried. */
export class TerminalTransactionError extends Error {
  readonly code: string;
  constructor(message: string, code = "VALIDATION_FAILED") {
    super(message);
    this.name = "TerminalTransactionError";
    this.code = code;
  }
}

/** Environment failure — the worker retries until the attempt ceiling. */
export class TransientTransactionError extends Error {
  readonly code: string;
  constructor(message: string, code = "RPC_FAILURE") {
    super(message);
    this.name = "TransientTransactionError";
    this.code = code;
  }
}

/** Backwards-compatible alias used by the existing handlers. */
export class PermanentError extends TerminalTransactionError {
  constructor(message: string, code = "VALIDATION_FAILED") {
    super(message, code);
    this.name = "PermanentError";
  }
}

export function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null
    ? (error as { code?: string }).code
    : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** true when the failure is terminal and must not be retried. */
export function isTerminalError(error: unknown): boolean {
  if (error instanceof TerminalTransactionError) return true;
  if (error instanceof TransientTransactionError) return false;
  const code = errorCode(error);
  if (code && TERMINAL_CODES.has(code)) return true;
  if (code && TRANSIENT_CODES.has(code)) return false;
  return false;
}
