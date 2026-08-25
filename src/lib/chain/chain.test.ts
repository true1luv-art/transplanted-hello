import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { config } from "@/lib/config/config";
import * as hive from "./hive";
import * as keychain from "./keychain";
import type { KeychainRawResponse, TransactionInfo } from "./types";

describe("hive client initialization", () => {
  beforeEach(() => hive.resetHiveClient());
  afterEach(() => hive.resetHiveClient());

  it("initializes a single cached dHive client", () => {
    expect(hive.getHiveClient()).toBe(hive.getHiveClient());
  });

  it("uses the configured RPC nodes", () => {
    expect(hive.getConfiguredNodes().length).toBeGreaterThan(0);
    expect(String(hive.getCurrentNode())).toContain("http");
  });

  it("throws NOT_CONFIGURED when no RPC nodes are configured", () => {
    const original = [...config.hive.rpcNodes];
    (config.hive as { rpcNodes: string[] }).rpcNodes = [];
    hive.resetHiveClient();
    expect(() => hive.getHiveClient()).toThrowError(/No Hive RPC nodes/);
    (config.hive as { rpcNodes: string[] }).rpcNodes = original;
    hive.resetHiveClient();
  });

  it("reports broadcasting as unconfigured by default", () => {
    expect(hive.isBroadcastConfigured()).toBe(false);
  });

  it("refuses to broadcast while disabled", async () => {
    await expect(hive.broadcastOperations([["custom_json", {}]])).rejects.toThrowError(
      /disabled or not configured/,
    );
  });
});

describe("transaction id validation", () => {
  it("accepts a 40-char hex id", () => {
    expect(hive.isValidTransactionId("a".repeat(40))).toBe(true);
  });
  it("rejects malformed ids", () => {
    expect(hive.isValidTransactionId("nope")).toBe(false);
    expect(hive.isValidTransactionId("z".repeat(40))).toBe(false);
  });
  it("throws INVALID_TRANSACTION_ID on lookup", async () => {
    await expect(hive.findTransaction("bad")).rejects.toMatchObject({
      code: "INVALID_TRANSACTION_ID",
    });
  });
});

describe("account lookup handling", () => {
  beforeEach(() => hive.resetHiveClient());
  afterEach(() => vi.restoreAllMocks());

  it("returns null for an unknown account", async () => {
    vi.spyOn(hive.getHiveClient().database, "getAccounts").mockResolvedValue([]);
    expect(await hive.findAccount("ghost")).toBeNull();
    expect(await hive.accountExists("ghost")).toBe(false);
  });

  it("throws ACCOUNT_NOT_FOUND from getAccount", async () => {
    vi.spyOn(hive.getHiveClient().database, "getAccounts").mockResolvedValue([]);
    await expect(hive.getAccount("ghost")).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("wraps RPC failures", async () => {
    vi.spyOn(hive.getHiveClient().database, "getAccounts").mockRejectedValue(new Error("boom"));
    await expect(hive.findAccount("alice")).rejects.toMatchObject({ code: "RPC_FAILURE" });
  });

  it("throws MALFORMED_RESPONSE when the node returns garbage", async () => {
    vi.spyOn(hive.getHiveClient().database, "getAccounts").mockResolvedValue(
      null as unknown as never,
    );
    await expect(hive.findAccount("alice")).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

describe("transaction normalization and inspection", () => {
  const txId = "b".repeat(40);
  const raw = {
    transaction_id: txId,
    block_num: 91234567,
    transaction_num: 3,
    expiration: "2026-01-01T00:00:00",
    operations: [
      ["transfer", { from: "alice", to: "hivemint", amount: "1.500 HIVE", memo: "mint:42" }],
      [
        "custom_json",
        { id: "hivemint", json: '{"a":1}', required_auths: ["alice"], required_posting_auths: [] },
      ],
    ],
  };

  it("normalizes a condenser_api transaction", () => {
    const tx = hive.normalizeTransaction(txId, raw);
    expect(tx.blockNumber).toBe(91234567);
    expect(tx.operations).toHaveLength(2);
  });

  it("normalizes appbase {type,value} operations", () => {
    const tx = hive.normalizeTransaction(txId, {
      ...raw,
      operations: [{ type: "transfer_operation", value: { from: "a", to: "b" } }],
    });
    expect(tx.operations[0]?.[0]).toBe("transfer");
  });

  it("throws MALFORMED_RESPONSE without an operations array", () => {
    expect(() => hive.normalizeTransaction(txId, { block_num: 1 })).toThrowError(/operations/);
  });

  it("extracts transfers and custom_jsons", () => {
    const tx = hive.normalizeTransaction(txId, raw);
    expect(hive.extractTransfers(tx)[0]).toEqual({
      from: "alice",
      to: "hivemint",
      amount: "1.500 HIVE",
      memo: "mint:42",
    });
    expect(hive.extractCustomJsons(tx)[0]?.requiredAuths).toEqual(["alice"]);
    expect(hive.getOperationsOfType(tx, "vote")).toHaveLength(0);
  });

  it("parses assets and rejects invalid ones", () => {
    expect(hive.parseAsset("1.500 HIVE")).toEqual({ amount: 1.5, symbol: "HIVE" });
    expect(() => hive.parseAsset("nope")).toThrowError(/Invalid Hive asset/);
  });

  it("derives transaction status", async () => {
    const tx: TransactionInfo = hive.normalizeTransaction(txId, raw);
    vi.spyOn(hive, "findTransaction");
    expect(tx.blockNumber > 0).toBe(true);
    expect(await hive.getTransactionStatus("zzz")).toBe("failed");
  });
});

describe("keychain foundation", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("reports unavailable without the extension", () => {
    expect(keychain.isKeychainAvailable()).toBe(false);
  });

  it("throws KeychainUnavailableError when broadcasting without the extension", () => {
    expect(() =>
      keychain.requestBroadcast({ account: "alice", operations: [], keyType: "active" }),
    ).toThrowError(/not installed/);
  });

  it("formats amounts to 3 decimals", () => {
    expect(keychain.formatAmount(1.5)).toBe("1.500");
    expect(keychain.formatAmount("2")).toBe("2.000");
  });

  it("normalizes a successful response", () => {
    const raw: KeychainRawResponse = { success: true, message: "ok", result: { id: "abc" } };
    const res = keychain.normalizeKeychainResponse(raw);
    expect(res.success).toBe(true);
    expect(res.transactionId).toBe("abc");
    expect(keychain.toBroadcastResult(res)).toMatchObject({ transactionId: "abc", mock: false });
  });

  it("normalizes an error response", () => {
    const res = keychain.normalizeKeychainResponse({ success: false, error: "user_cancel" });
    expect(res.success).toBe(false);
    expect(res.message).toBe("user_cancel");
  });

  it("rejects when the extension returns success: false", async () => {
    (globalThis as { window?: unknown }).window = {
      hive_keychain: {
        requestCustomJson: (
          _a: string,
          _i: string,
          _k: string,
          _j: string,
          _d: string,
          cb: (r: KeychainRawResponse) => void,
        ) => cb({ success: false, message: "Request was canceled by the user" }),
      },
    };
    await expect(
      keychain.requestCustomJson({ account: "alice", id: "x", json: {}, keyType: "active" }),
    ).rejects.toThrowError(/canceled/);
  });

  it("resolves a successful custom_json request", async () => {
    (globalThis as { window?: unknown }).window = {
      hive_keychain: {
        requestCustomJson: (
          _a: string,
          _i: string,
          _k: string,
          _j: string,
          _d: string,
          cb: (r: KeychainRawResponse) => void,
        ) => cb({ success: true, message: "ok", result: { id: "d".repeat(40) } }),
      },
    };
    const res = await keychain.requestCustomJson({
      account: "alice",
      id: "hivemint",
      json: { hello: "world" },
      keyType: "active",
    });
    expect(res.transactionId).toBe("d".repeat(40));
  });
});
