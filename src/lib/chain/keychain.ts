/**
 * Centralized Hive Keychain (browser extension) transport adapter.
 *
 * Responsibility: "How do we ask Hive Keychain to sign/broadcast an operation?"
 *
 * It knows how to ask the user to sign an already PREPARED operation (built by
 * `lib/chain/hive.ts`). It contains no NFT / collection / marketplace business
 * logic and no React/UI logic.
 */
import type {
  BroadcastResult,
  KeychainBroadcastRequest,
  KeychainCustomJsonRequest,
  KeychainRawResponse,
  KeychainResponse,
  KeychainNftIssueRequest,
  KeychainSignBufferRequest,
  KeychainTransferRequest,
  TransactionId,
} from "./types";

export class KeychainUnavailableError extends Error {
  readonly code = "KEYCHAIN_UNAVAILABLE";
  constructor(message = "Hive Keychain extension is not installed or not available") {
    super(message);
    this.name = "KeychainUnavailableError";
  }
}

export class KeychainRequestError extends Error {
  readonly code = "KEYCHAIN_REJECTED";
  constructor(
    message: string,
    readonly response?: KeychainRawResponse,
  ) {
    super(message);
    this.name = "KeychainRequestError";
  }
}

/** Minimal shape of the `window.hive_keychain` API we depend on. */
interface HiveKeychainApi {
  requestHandshake?: (cb: () => void) => void;
  requestTransfer: (
    account: string,
    to: string,
    amount: string,
    memo: string,
    currency: string,
    cb: (r: KeychainRawResponse) => void,
    enforce?: boolean,
  ) => void;
  requestCustomJson: (
    account: string,
    id: string,
    keyType: string,
    json: string,
    displayName: string,
    cb: (r: KeychainRawResponse) => void,
  ) => void;
  requestBroadcast: (
    account: string,
    operations: unknown[],
    keyType: string,
    cb: (r: KeychainRawResponse) => void,
  ) => void;
  requestSignBuffer: (
    account: string,
    message: string,
    keyType: string,
    cb: (r: KeychainRawResponse) => void,
  ) => void;
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychainApi;
  }
}

/** true when the Keychain extension is present in this browser. */
export function isKeychainAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.hive_keychain === "object";
}

function requireKeychain(): HiveKeychainApi {
  if (typeof window === "undefined" || !window.hive_keychain) throw new KeychainUnavailableError();
  return window.hive_keychain;
}

/** Waits (polling) for the extension to inject itself, up to `timeoutMs`. */
export async function waitForKeychain(timeoutMs = 3000, intervalMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isKeychainAvailable()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/** Normalizes any raw Keychain callback payload into `KeychainResponse`. */
export function normalizeKeychainResponse<T = unknown>(
  raw: KeychainRawResponse,
): KeychainResponse<T> {
  const data = (raw?.result ?? null) as T | null;
  const txId =
    (raw?.result as { id?: string } | null)?.id ??
    (raw?.result as { tx_id?: string } | null)?.tx_id ??
    undefined;
  return {
    success: Boolean(raw?.success),
    message: raw?.message ?? (raw?.error ? String(raw.error) : ""),
    result: data,
    transactionId: txId as TransactionId | undefined,
    raw,
  };
}

/** Wraps a callback-style Keychain call into a promise, throwing on rejection. */
function invoke<T>(
  fn: (cb: (r: KeychainRawResponse) => void) => void,
): Promise<KeychainResponse<T>> {
  return new Promise((resolve, reject) => {
    try {
      fn((raw) => {
        const response = normalizeKeychainResponse<T>(raw);
        if (!response.success) {
          reject(new KeychainRequestError(response.message || "Keychain request failed", raw));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(
        error instanceof Error
          ? error
          : new KeychainRequestError("Keychain request threw", undefined),
      );
    }
  });
}

/** Formats a Hive amount to the 3-decimal precision the chain requires. */
export function formatAmount(amount: number | string): string {
  return Number(amount).toFixed(3);
}

/** Generic operation broadcast — the primary transport entry point. */
export function requestBroadcast(
  request: KeychainBroadcastRequest,
): Promise<KeychainResponse<{ id?: string }>> {
  const keychain = requireKeychain();
  return invoke((cb) =>
    keychain.requestBroadcast(request.account, request.operations, request.keyType, cb),
  );
}

export function requestTransfer(
  request: KeychainTransferRequest,
): Promise<KeychainResponse<{ id?: string }>> {
  const keychain = requireKeychain();
  return invoke((cb) =>
    keychain.requestTransfer(
      request.account,
      request.to,
      formatAmount(request.amount),
      request.memo ?? "",
      request.currency,
      cb,
      true,
    ),
  );
}

export function requestCustomJson(
  request: KeychainCustomJsonRequest,
): Promise<KeychainResponse<{ id?: string }>> {
  const keychain = requireKeychain();
  const json = typeof request.json === "string" ? request.json : JSON.stringify(request.json);
  return invoke((cb) =>
    keychain.requestCustomJson(
      request.account,
      request.id,
      request.keyType,
      json,
      request.displayName ?? request.id,
      cb,
    ),
  );
}

/** Signs an arbitrary message — used for proof-of-ownership style login flows. */
export function requestSignBuffer(
  request: KeychainSignBufferRequest,
): Promise<KeychainResponse<string>> {
  const keychain = requireKeychain();
  return invoke((cb) =>
    keychain.requestSignBuffer(request.account, request.message, request.keyType, cb),
  );
}

/** Maps a successful Keychain response onto the shared `BroadcastResult`. */
export function toBroadcastResult(response: KeychainResponse<unknown>): BroadcastResult {
  return {
    transactionId: response.transactionId ?? "",
    blockNumber: undefined,
    success: response.success,
    mock: false,
  };
}

/* ------------------------------------------------------------------ *
 * NFT issuance signing
 * ------------------------------------------------------------------ */

/** Why a Keychain request did not produce a broadcast. */
export type KeychainFailureReason =
  | "unavailable"
  | "rejected"
  | "cancelled"
  | "insufficient_funds"
  | "error";

export interface KeychainIssueOutcome {
  success: boolean;
  /** REAL Hive transaction id, present only on a successful broadcast. */
  transactionId?: TransactionId | undefined;
  reason?: KeychainFailureReason | undefined;
  message: string;
}

/** Maps any Keychain failure onto a stable, user-presentable reason. */
export function classifyKeychainError(error: unknown): {
  reason: KeychainFailureReason;
  message: string;
} {
  if (error instanceof KeychainUnavailableError) {
    return { reason: "unavailable", message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error ?? "Keychain failed");
  if (/cancel/i.test(message)) return { reason: "cancelled", message: "Transaction cancelled" };
  if (/reject|declin|denied/i.test(message)) {
    return { reason: "rejected", message: "Transaction rejected in Hive Keychain" };
  }
  if (/insufficient|balance/i.test(message)) {
    return { reason: "insufficient_funds", message };
  }
  return { reason: "error", message };
}

/**
 * Asks the user to sign and broadcast a prepared NFT issuance.
 * Never throws — always returns a structured outcome so the mint service can
 * keep the asset recoverable.
 */
export async function requestNftIssuance(
  request: KeychainNftIssueRequest,
): Promise<KeychainIssueOutcome> {
  const { issuance } = request;
  if (!isKeychainAvailable() && !(await waitForKeychain())) {
    return {
      success: false,
      reason: "unavailable",
      message: "Hive Keychain is not installed or unavailable in this browser",
    };
  }
  try {
    const response = await requestBroadcast({
      account: issuance.account,
      operations: issuance.operations,
      keyType: issuance.keyType,
    });
    const transactionId = response.transactionId;
    if (!transactionId) {
      return {
        success: false,
        reason: "error",
        message: "Keychain approved the request but returned no transaction id",
      };
    }
    return { success: true, transactionId, message: "Broadcast to Hive" };
  } catch (error) {
    const { reason, message } = classifyKeychainError(error);
    return { success: false, reason, message };
  }
}
