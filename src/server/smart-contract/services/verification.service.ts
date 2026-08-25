/**
 * server/smart-contract/services/verification.service.ts
 *
 * Independent verification of a blockchain transaction.
 *
 *   worker -> VerificationService -> lib/chain/hive.ts -> dHive -> Hive
 *
 * The pending MongoDB document is only a *request*: Hive is the source of
 * truth. Nothing here trusts client-supplied status/success flags, and this
 * module never instantiates dHive itself.
 *
 * SERVER-ONLY.
 */
import { findTransaction, isValidTransactionId, HiveChainError } from "@/lib/chain/hive";
import type { NormalizedOperation, TransactionInfo } from "@/lib/chain/types";

/** What the application expects to find on-chain for a pending transaction. */
export interface TransactionExpectation {
  /** The blockchain transaction id claimed for this pending request. */
  hiveTransactionId: string;
  /** Hive operation name, e.g. "transfer" or "custom_json". */
  operationType: string;
  sender?: string | undefined;
  recipient?: string | undefined;
  amount?: number | undefined;
  symbol?: string | undefined;
  /** Absolute tolerance for the amount comparison (default 0.0005). */
  amountTolerance?: number | undefined;
  /** Substring the memo / custom-json payload must contain. */
  memoIncludes?: string | undefined;
  /** Require the transaction to be included in a block (default true). */
  requireConfirmed?: boolean | undefined;
}

export type VerificationFailureCode =
  | "MISSING_HIVE_TRANSACTION_ID"
  | "INVALID_TRANSACTION_ID"
  | "TRANSACTION_NOT_FOUND"
  | "NOT_CONFIRMED"
  | "OPERATION_NOT_FOUND"
  | "WRONG_SENDER"
  | "WRONG_RECIPIENT"
  | "WRONG_AMOUNT"
  | "WRONG_SYMBOL"
  | "WRONG_MEMO"
  | "RPC_FAILURE"
  | "MALFORMED_RESPONSE";

export interface VerificationSuccess {
  ok: true;
  transaction: TransactionInfo;
  operation: NormalizedOperation;
}

export interface VerificationFailure {
  ok: false;
  code: VerificationFailureCode;
  reason: string;
  /** true when the failure is environmental and the worker should retry. */
  retryable: boolean;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

/** Injectable chain reader so unit tests never hit a real RPC node. */
export interface VerificationDeps {
  findTransaction: (txId: string) => Promise<TransactionInfo | null>;
}

const defaultDeps: VerificationDeps = { findTransaction };

const account = (value: string | undefined) => (value ?? "").trim().toLowerCase();

function fail(
  code: VerificationFailureCode,
  reason: string,
  retryable: boolean,
): VerificationFailure {
  return { ok: false, code, reason, retryable };
}

/**
 * Verifies that the expected operation really exists on Hive.
 *
 * Retryable failures (RPC down, transaction not indexed yet, not yet in a
 * block) never reject a transaction permanently; mismatches always do.
 */
export async function verifyHiveTransaction(
  expectation: TransactionExpectation,
  deps: VerificationDeps = defaultDeps,
): Promise<VerificationResult> {
  const txId = expectation.hiveTransactionId?.trim() ?? "";
  if (!txId) {
    return fail(
      "MISSING_HIVE_TRANSACTION_ID",
      "No Hive transaction id on the pending request",
      false,
    );
  }
  if (!isValidTransactionId(txId)) {
    return fail("INVALID_TRANSACTION_ID", `Malformed Hive transaction id: ${txId}`, false);
  }

  let tx: TransactionInfo | null;
  try {
    tx = await deps.findTransaction(txId);
  } catch (error) {
    if (error instanceof HiveChainError && error.code === "MALFORMED_RESPONSE") {
      return fail("MALFORMED_RESPONSE", error.message, true);
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail("RPC_FAILURE", `Hive lookup failed: ${message}`, true);
  }

  if (!tx) {
    // Propagation lag is normal — retry until the attempt ceiling turns it terminal.
    return fail("TRANSACTION_NOT_FOUND", `Hive transaction not found: ${txId}`, true);
  }

  if ((expectation.requireConfirmed ?? true) && !(tx.blockNumber > 0)) {
    return fail("NOT_CONFIRMED", `Hive transaction ${txId} is not in a block yet`, true);
  }

  const candidates = tx.normalizedOperations.filter((op) => op.type === expectation.operationType);
  if (candidates.length === 0) {
    return fail(
      "OPERATION_NOT_FOUND",
      `Transaction ${txId} contains no "${expectation.operationType}" operation`,
      false,
    );
  }

  // Report the most specific mismatch found across the candidate operations.
  let lastFailure: VerificationFailure | null = null;
  for (const op of candidates) {
    const mismatch = matchOperation(op, expectation);
    if (!mismatch) return { ok: true, transaction: tx, operation: op };
    lastFailure = mismatch;
  }
  return lastFailure ?? fail("OPERATION_NOT_FOUND", "No matching operation", false);
}

/** Returns null when the operation satisfies the expectation. */
export function matchOperation(
  op: NormalizedOperation,
  expectation: TransactionExpectation,
): VerificationFailure | null {
  if (expectation.sender && account(op.sender) !== account(expectation.sender)) {
    return fail(
      "WRONG_SENDER",
      `Expected sender @${expectation.sender}, got @${op.sender ?? "?"}`,
      false,
    );
  }
  if (expectation.recipient && account(op.recipient) !== account(expectation.recipient)) {
    return fail(
      "WRONG_RECIPIENT",
      `Expected recipient @${expectation.recipient}, got @${op.recipient ?? "?"}`,
      false,
    );
  }
  if (expectation.amount !== undefined) {
    const tolerance = expectation.amountTolerance ?? 0.0005;
    const actual = op.amount;
    if (actual === undefined || Math.abs(actual - expectation.amount) > tolerance) {
      return fail(
        "WRONG_AMOUNT",
        `Expected amount ${expectation.amount}, got ${actual ?? "none"}`,
        false,
      );
    }
  }
  if (expectation.symbol && (op.symbol ?? "").toUpperCase() !== expectation.symbol.toUpperCase()) {
    return fail(
      "WRONG_SYMBOL",
      `Expected ${expectation.symbol}, got ${op.symbol ?? "none"}`,
      false,
    );
  }
  if (expectation.memoIncludes && !(op.memo ?? "").includes(expectation.memoIncludes)) {
    return fail("WRONG_MEMO", `Memo does not reference "${expectation.memoIncludes}"`, false);
  }
  return null;
}

/** Service wrapper — the shape the worker depends on. */
export class HiveVerificationService {
  readonly name = "HiveVerificationService";
  constructor(private readonly deps: VerificationDeps = defaultDeps) {}

  verify(expectation: TransactionExpectation): Promise<VerificationResult> {
    return verifyHiveTransaction(expectation, this.deps);
  }
}

/** Verification is skipped in mock mode — the mock chain has no on-chain proof. */
export class NoopVerificationService {
  readonly name = "NoopVerificationService";
  async verify(): Promise<VerificationResult> {
    return {
      ok: true,
      transaction: {
        transactionId: "",
        blockNumber: 0,
        transactionNumber: 0,
        expiration: "",
        operations: [],
        normalizedOperations: [],
      },
      operation: { type: "", data: {} },
    };
  }
}

export interface VerificationService {
  readonly name: string;
  verify(expectation: TransactionExpectation): Promise<VerificationResult>;
}
