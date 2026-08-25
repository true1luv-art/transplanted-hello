/**
 * Phase 6C — Hive verification unit tests.
 * Fixtures only: no real Hive RPC, no spending.
 */
import { describe, expect, it } from "vitest";
import type { TransactionInfo } from "@/lib/chain/types";
import { normalizeOperation } from "@/lib/chain/hive";
import {
  HiveVerificationService,
  verifyHiveTransaction,
  type TransactionExpectation,
} from "./services/verification.service";
import { isTerminalError, TERMINAL_CODES, TRANSIENT_CODES } from "./lib/errors";

const TX_ID = "a".repeat(40);

function transferTx(
  overrides: Partial<{
    from: string;
    to: string;
    amount: string;
    memo: string;
    block: number;
  }> = {},
): TransactionInfo {
  const data = {
    from: overrides.from ?? "alice",
    to: overrides.to ?? "hivemint",
    amount: overrides.amount ?? "10.000 HIVE",
    memo: overrides.memo ?? "Collection deployment · Test",
  };
  const operations = [["transfer", data] as [string, Record<string, unknown>]];
  return {
    transactionId: TX_ID,
    blockNumber: overrides.block ?? 1234,
    transactionNumber: 0,
    expiration: "",
    operations,
    normalizedOperations: operations.map(normalizeOperation),
  };
}

const deps = (tx: TransactionInfo | null, error?: Error) => ({
  findTransaction: async () => {
    if (error) throw error;
    return tx;
  },
});

const base: TransactionExpectation = {
  hiveTransactionId: TX_ID,
  operationType: "transfer",
  sender: "alice",
  recipient: "hivemint",
  amount: 10,
  symbol: "HIVE",
};

describe("verifyHiveTransaction", () => {
  it("verifies a matching transfer", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx()));
    expect(result.ok).toBe(true);
  });

  it("is case-insensitive about account names", async () => {
    const result = await verifyHiveTransaction(
      { ...base, sender: "Alice", recipient: "HiveMint" },
      deps(transferTx()),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a missing hive transaction id permanently", async () => {
    const result = await verifyHiveTransaction({ ...base, hiveTransactionId: "" }, deps(null));
    expect(result).toMatchObject({
      ok: false,
      code: "MISSING_HIVE_TRANSACTION_ID",
      retryable: false,
    });
  });

  it("rejects a malformed transaction id permanently", async () => {
    const result = await verifyHiveTransaction({ ...base, hiveTransactionId: "nope" }, deps(null));
    expect(result).toMatchObject({ ok: false, code: "INVALID_TRANSACTION_ID", retryable: false });
  });

  it("retries when the transaction is not indexed yet", async () => {
    const result = await verifyHiveTransaction(base, deps(null));
    expect(result).toMatchObject({ ok: false, code: "TRANSACTION_NOT_FOUND", retryable: true });
  });

  it("retries when the RPC call fails", async () => {
    const result = await verifyHiveTransaction(base, deps(null, new Error("socket hang up")));
    expect(result).toMatchObject({ ok: false, code: "RPC_FAILURE", retryable: true });
  });

  it("retries while the transaction is not in a block", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx({ block: 0 })));
    expect(result).toMatchObject({ ok: false, code: "NOT_CONFIRMED", retryable: true });
  });

  it("rejects the wrong sender permanently", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx({ from: "bob" })));
    expect(result).toMatchObject({ ok: false, code: "WRONG_SENDER", retryable: false });
  });

  it("rejects the wrong recipient permanently", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx({ to: "attacker" })));
    expect(result).toMatchObject({ ok: false, code: "WRONG_RECIPIENT", retryable: false });
  });

  it("rejects the wrong amount permanently", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx({ amount: "1.000 HIVE" })));
    expect(result).toMatchObject({ ok: false, code: "WRONG_AMOUNT", retryable: false });
  });

  it("rejects the wrong asset symbol permanently", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx({ amount: "10.000 HBD" })));
    expect(result).toMatchObject({ ok: false, code: "WRONG_SYMBOL", retryable: false });
  });

  it("rejects a missing operation type permanently", async () => {
    const result = await verifyHiveTransaction(
      { ...base, operationType: "custom_json" },
      deps(transferTx()),
    );
    expect(result).toMatchObject({ ok: false, code: "OPERATION_NOT_FOUND", retryable: false });
  });

  it("rejects a memo that does not reference the request", async () => {
    const result = await verifyHiveTransaction(
      { ...base, memoIncludes: "TX-ABC" },
      deps(transferTx()),
    );
    expect(result).toMatchObject({ ok: false, code: "WRONG_MEMO", retryable: false });
  });

  it("accepts small rounding differences within tolerance", async () => {
    const result = await verifyHiveTransaction(base, deps(transferTx({ amount: "10.000 HIVE" })));
    expect(result.ok).toBe(true);
  });

  it("works through the service wrapper", async () => {
    const service = new HiveVerificationService(deps(transferTx()));
    expect((await service.verify(base)).ok).toBe(true);
  });
});

describe("failure taxonomy", () => {
  it("classifies verification codes consistently", () => {
    for (const code of ["WRONG_SENDER", "WRONG_AMOUNT", "OPERATION_NOT_FOUND"]) {
      expect(TERMINAL_CODES.has(code)).toBe(true);
      expect(isTerminalError(Object.assign(new Error(code), { code }))).toBe(true);
    }
    for (const code of ["RPC_FAILURE", "NOT_CONFIRMED", "TRANSACTION_NOT_FOUND"]) {
      expect(TRANSIENT_CODES.has(code)).toBe(true);
      expect(isTerminalError(Object.assign(new Error(code), { code }))).toBe(false);
    }
  });
});
