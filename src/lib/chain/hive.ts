/**
 * Centralized SERVER-SIDE Hive adapter (dHive).
 *
 * Responsibility: "How do we communicate with Hive?"
 * Nothing else in the backend should instantiate a dHive client or call dHive
 * directly — everything goes through this module.
 *
 * Explicit non-goals (these belong to `src/server/smart-contract/`):
 * - transaction verification / approval rules
 * - NFT, collection or marketplace business logic
 * - pending transaction monitoring
 *
 * Runs on the server AND in the browser: the read/prepare surface (accounts,
 * balances, transactions, NFT issuance preparation) is isomorphic. Only the
 * server-key signing helpers at the bottom require configuration that never
 * reaches the browser.
 */
import { Client, PrivateKey } from "@hiveio/dhive";
import {
  config,
  getIssuerCredentials,
  getPlatformNftSymbol,
  isIssuerConfigured,
} from "@/lib/config/config";
import { logger } from "@/lib/config/logger";
import { hiveAvatarUrl, normalizeHiveUsername } from "./identity";
import { assertCanonicalProperties } from "./nft-properties";

import type {
  BroadcastResult,
  CustomJsonOperationData,
  DynamicGlobalProperties,
  HiveAccount,
  HiveAccountProfile,
  HiveAccountStatus,
  HiveProfileMetadata,
  HiveConnectionStatus,
  HiveOperation,
  KeyRole,
  NormalizedOperation,
  TransactionIdKind,
  TransactionId,
  TransactionInfo,
  TransactionStatus,
  TransferOperationData,
  HiveEngineContractCall,
  HiveNftIssueProperties,
  HiveNftInfo,
  NftIssuanceOutcome,
  NftIssuanceParams,
  PreparedNftIssuance,
} from "./types";

/** Error thrown for any Hive chain-layer failure. */
export class HiveChainError extends Error {
  readonly code:
    | "RPC_FAILURE"
    | "ACCOUNT_NOT_FOUND"
    | "TRANSACTION_NOT_FOUND"
    | "INVALID_TRANSACTION_ID"
    | "MALFORMED_RESPONSE"
    | "NOT_CONFIGURED"
    | "BROADCAST_DISABLED";

  constructor(
    code: HiveChainError["code"],
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HiveChainError";
    this.code = code;
  }
}

let client: Client | null = null;

/** Lazily creates (and caches) the single dHive client from configuration. */
export function getHiveClient(): Client {
  if (client) return client;
  const { rpcNodes, timeout, failoverThreshold, chainId, addressPrefix } = config.hive;
  if (rpcNodes.length === 0) {
    throw new HiveChainError("NOT_CONFIGURED", "No Hive RPC nodes configured (HIVE_RPC_NODES)");
  }
  client = new Client(rpcNodes, {
    timeout,
    failoverThreshold,
    ...(chainId ? { chainId } : {}),
    ...(addressPrefix ? { addressPrefix: addressPrefix as `STM` } : {}),
  });
  logger.info("BLOCKCHAIN:HIVE", `dHive client initialized (${config.hive.network})`, {
    nodes: rpcNodes,
  });
  return client;
}

/** Test/DI hook — resets the cached client so configuration changes take effect. */
export function resetHiveClient(): void {
  client = null;
}

/** The RPC endpoints the client is configured with. */
export function getConfiguredNodes(): string[] {
  return [...config.hive.rpcNodes];
}

/** The RPC endpoint currently in use by the client. */
export function getCurrentNode(): string {
  const address = getHiveClient().address;
  return Array.isArray(address) ? (address[0] ?? "") : address;
}

/** true when the backend has everything it needs to broadcast real operations. */
export function isBroadcastConfigured(): boolean {
  return Boolean(config.hive.broadcastEnabled && config.hive.account && config.hive.activeKey);
}

async function rpc<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error("BLOCKCHAIN:HIVE", `${label} failed`, error);
    throw new HiveChainError("RPC_FAILURE", `Hive RPC call failed: ${label}`, error);
  }
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** Chain head / dynamic global properties. */
export function getDynamicGlobalProperties(): Promise<DynamicGlobalProperties> {
  return rpc("get_dynamic_global_properties", () =>
    getHiveClient().database.getDynamicGlobalProperties(),
  );
}

/** Current head block number. */
export async function getHeadBlockNumber(): Promise<number> {
  const props = await getDynamicGlobalProperties();
  const head = props?.head_block_number;
  if (typeof head !== "number") {
    throw new HiveChainError("MALFORMED_RESPONSE", "head_block_number missing from RPC response");
  }
  return head;
}

/** Returns the account, or null when it does not exist. */
export async function findAccount(username: string): Promise<HiveAccount | null> {
  const name = username.trim().toLowerCase();
  if (!name) return null;
  const accounts = await rpc("get_accounts", () => getHiveClient().database.getAccounts([name]));
  if (!Array.isArray(accounts)) {
    throw new HiveChainError("MALFORMED_RESPONSE", "get_accounts did not return an array");
  }
  return accounts[0] ?? null;
}

/** Returns the account, throwing ACCOUNT_NOT_FOUND when missing. */
export async function getAccount(username: string): Promise<HiveAccount> {
  const account = await findAccount(username);
  if (!account) {
    throw new HiveChainError("ACCOUNT_NOT_FOUND", `Hive account not found: @${username}`);
  }
  return account;
}

export async function accountExists(username: string): Promise<boolean> {
  return (await findAccount(username)) !== null;
}

/* ------------------------------------------------------------------ *
 * Account identity, profile metadata and balance
 *
 * On Hive the account name IS the blockchain identity ("wallet address").
 * There is no separate address concept — never model one.
 * ------------------------------------------------------------------ */

// Identity/URL derivation lives in the browser-safe `identity` module so the
// frontend can reuse it without pulling in dHive. Re-exported for backend callers.
export { hiveAvatarUrl, hiveCoverUrl, normalizeHiveUsername } from "./identity";


function readProfileMetadata(raw: unknown): HiveProfileMetadata | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as { profile?: HiveProfileMetadata };
    return parsed && typeof parsed === "object" && parsed.profile ? parsed.profile : null;
  } catch {
    return null;
  }
}

/**
 * Extracts the `profile` metadata published by a Hive account.
 * `posting_json_metadata` takes precedence over the legacy `json_metadata`.
 */
export function parseProfileMetadata(account: HiveAccount): HiveProfileMetadata {
  const posting = readProfileMetadata(
    (account as unknown as { posting_json_metadata?: unknown }).posting_json_metadata,
  );
  const legacy = readProfileMetadata(
    (account as unknown as { json_metadata?: unknown }).json_metadata,
  );
  return { ...(legacy ?? {}), ...(posting ?? {}) };
}

/** Normalized profile view for a Hive account (chain is the source of truth). */
export function parseAccountProfile(account: HiveAccount): HiveAccountProfile {
  const username = normalizeHiveUsername(account.name);
  const profile = parseProfileMetadata(account);
  return {
    username,
    displayName: profile.name || undefined,
    about: profile.about || undefined,
    avatarUrl: hiveAvatarUrl(username),
    profileImage: profile.profile_image || undefined,
    coverImage: profile.cover_image || undefined,
    location: profile.location || undefined,
    website: profile.website || undefined,
  };
}

/** Fetches and normalizes the on-chain profile of a Hive account. */
export async function getAccountProfile(username: string): Promise<HiveAccountProfile> {
  return parseAccountProfile(await getAccount(username));
}

/** Parses an asset string such as "1.234 HIVE" into a number. */
export function parseAssetAmount(asset: unknown): number {
  if (typeof asset === "number") return asset;
  if (typeof asset === "string") {
    const value = Number.parseFloat(asset.split(" ")[0] ?? "");
    return Number.isFinite(value) ? value : 0;
  }
  if (asset && typeof asset === "object" && "amount" in asset) {
    const { amount, precision } = asset as { amount: string | number; precision?: number };
    const value = Number(amount) / 10 ** (precision ?? 3);
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
}

/** Liquid HIVE balance of an account, as reported by the chain. */
export function readAccountHiveBalance(account: HiveAccount): number {
  return parseAssetAmount(account.balance);
}

/**
 * Fetches the liquid HIVE balance of an account.
 * The chain is authoritative; anything persisted is only a cached index.
 */
export async function getAccountHiveBalance(username: string): Promise<number> {
  return readAccountHiveBalance(await getAccount(username));
}


/** A Hive transaction id is 40 lowercase hex characters. */
export function isValidTransactionId(txId: string): boolean {
  return /^[0-9a-f]{40}$/i.test(txId.trim());
}

/**
 * Retrieves a transaction by id. Requires an RPC node with account history
 * enabled. Returns null when the node reports the transaction as unknown.
 */
export async function findTransaction(txId: TransactionId): Promise<TransactionInfo | null> {
  if (!isValidTransactionId(txId)) {
    throw new HiveChainError("INVALID_TRANSACTION_ID", `Malformed Hive transaction id: ${txId}`);
  }
  let raw: unknown;
  try {
    raw = await getHiveClient().call("condenser_api", "get_transaction", [txId.toLowerCase()]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unknown transaction|not found|assert exception/i.test(message)) return null;
    logger.error("BLOCKCHAIN:HIVE", "get_transaction failed", error);
    throw new HiveChainError("RPC_FAILURE", "Hive RPC call failed: get_transaction", error);
  }
  if (!raw || typeof raw !== "object") return null;
  return normalizeTransaction(txId, raw as Record<string, unknown>);
}

/** Retrieves a transaction, throwing TRANSACTION_NOT_FOUND when absent. */
export async function getTransaction(txId: TransactionId): Promise<TransactionInfo> {
  const tx = await findTransaction(txId);
  if (!tx) {
    throw new HiveChainError("TRANSACTION_NOT_FOUND", `Hive transaction not found: ${txId}`);
  }
  return tx;
}

/** Shapes a raw condenser_api transaction into `TransactionInfo`. */
export function normalizeTransaction(
  txId: TransactionId,
  raw: Record<string, unknown>,
): TransactionInfo {
  const ops = raw["operations"];
  if (!Array.isArray(ops)) {
    throw new HiveChainError("MALFORMED_RESPONSE", `Transaction ${txId} has no operations array`);
  }
  const operations: HiveOperation[] = ops
    .map((op) => {
      if (Array.isArray(op) && typeof op[0] === "string") {
        return [op[0], (op[1] ?? {}) as Record<string, unknown>] as HiveOperation;
      }
      if (op && typeof op === "object" && "type" in op) {
        const o = op as { type: string; value?: Record<string, unknown> };
        return [o.type.replace(/_operation$/, ""), o.value ?? {}] as HiveOperation;
      }
      return null;
    })
    .filter((op): op is HiveOperation => op !== null);

  const timestamp = raw["timestamp"] ? String(raw["timestamp"]) : undefined;

  return {
    transactionId: String(raw["transaction_id"] ?? txId).toLowerCase(),
    blockNumber: Number(raw["block_num"] ?? 0),
    transactionNumber: Number(raw["transaction_num"] ?? 0),
    timestamp,
    expiration: String(raw["expiration"] ?? ""),
    operations,
    normalizedOperations: operations.map(normalizeOperation),
  };
}

/**
 * Flattens a raw Hive operation into the generic shape the backend inspects.
 * Purely structural — it carries no NFT, collection or marketplace meaning.
 */
export function normalizeOperation([type, data]: HiveOperation): NormalizedOperation {
  const op: NormalizedOperation = { type, data };
  const str = (key: string) => (data[key] === undefined ? undefined : String(data[key]));

  if (data["from"] !== undefined) op.sender = str("from");
  else if (Array.isArray(data["required_auths"]) && data["required_auths"].length > 0) {
    op.sender = String((data["required_auths"] as unknown[])[0]);
  } else if (
    Array.isArray(data["required_posting_auths"]) &&
    data["required_posting_auths"].length > 0
  ) {
    op.sender = String((data["required_posting_auths"] as unknown[])[0]);
  } else if (data["account"] !== undefined) op.sender = str("account");

  if (data["to"] !== undefined) op.recipient = str("to");

  const asset = data["amount"];
  if (typeof asset === "string") {
    try {
      const { amount, symbol } = parseAsset(asset);
      op.amount = amount;
      op.symbol = symbol;
    } catch {
      /* leave amount unset for non-asset strings */
    }
  } else if (asset && typeof asset === "object") {
    const a = asset as { amount?: unknown; precision?: unknown; nai?: unknown };
    const precision = Number(a.precision ?? 3);
    const value = Number(a.amount ?? NaN);
    if (Number.isFinite(value)) op.amount = value / 10 ** precision;
    if (a.nai) op.symbol = String(a.nai);
  }

  if (typeof data["memo"] === "string") op.memo = data["memo"];
  else if (typeof data["json"] === "string") op.memo = data["json"];

  return op;
}

/* ------------------------------------------------------------------ *
 * Transaction identity
 * ------------------------------------------------------------------ */

/**
 * Classifies an identifier so the backend never confuses an application
 * transaction id (transactions_pending.transactionId / requestId) with a
 * blockchain transaction id produced by Hive.
 */
export function classifyTransactionId(id: string): TransactionIdKind {
  const value = id.trim();
  if (!value) return "unknown";
  if (isValidTransactionId(value)) return "hive";
  if (/^MOCK-HIVE-/i.test(value)) return "mock";
  if (/^(tx|req)[-_]/i.test(value)) return "application";
  return "unknown";
}

/** true when the id was produced by the Hive blockchain. */
export function isHiveTransactionId(id: string): boolean {
  return classifyTransactionId(id) === "hive";
}

/** true when the id was produced by a mock blockchain implementation. */
export function isMockTransactionId(id: string): boolean {
  return classifyTransactionId(id) === "mock";
}

/* ------------------------------------------------------------------ *
 * Connectivity diagnostics (no secrets, no broadcasting)
 * ------------------------------------------------------------------ */

/** Probes the configured RPC endpoint and reports a safe status summary. */
export async function checkHiveConnection(): Promise<HiveConnectionStatus> {
  const base = {
    network: config.hive.network,
    nodes: config.hive.rpcNodes.length,
  };
  const started = Date.now();
  try {
    const node = getCurrentNode();
    const headBlock = await getHeadBlockNumber();
    return { connected: true, node, headBlock, latencyMs: Date.now() - started, ...base };
  } catch (error) {
    return {
      connected: false,
      node: config.hive.rpcNodes[0] ?? "",
      error: error instanceof Error ? error.message : "Hive RPC unreachable",
      ...base,
    };
  }
}

/** Probes the configured platform Hive account. Never touches keys. */
export async function checkHiveAccount(username = config.hive.account): Promise<HiveAccountStatus> {
  if (!username) {
    return {
      configured: false,
      account: "",
      exists: false,
      error: "HIVE_ACCOUNT is not configured",
    };
  }
  try {
    return { configured: true, account: username, exists: await accountExists(username) };
  } catch (error) {
    return {
      configured: true,
      account: username,
      exists: false,
      error: error instanceof Error ? error.message : "Hive account lookup failed",
    };
  }
}

/** Confirmation status of a transaction id, without throwing on absence. */
export async function getTransactionStatus(txId: TransactionId): Promise<TransactionStatus> {
  if (!isValidTransactionId(txId)) return "failed";
  const tx = await findTransaction(txId);
  if (!tx) return "not_found";
  return tx.blockNumber > 0 ? "confirmed" : "pending";
}

/* ------------------------------------------------------------------ *
 * Operation inspection helpers (generic — no business rules)
 * ------------------------------------------------------------------ */

export function getOperationsOfType(tx: TransactionInfo, type: string): HiveOperation[] {
  return tx.operations.filter(([opType]) => opType === type);
}

export function extractTransfers(tx: TransactionInfo): TransferOperationData[] {
  return getOperationsOfType(tx, "transfer").map(([, data]) => ({
    from: String(data["from"] ?? ""),
    to: String(data["to"] ?? ""),
    amount: typeof data["amount"] === "string" ? data["amount"] : String(data["amount"] ?? ""),
    memo: String(data["memo"] ?? ""),
  }));
}

export function extractCustomJsons(tx: TransactionInfo): CustomJsonOperationData[] {
  return getOperationsOfType(tx, "custom_json").map(([, data]) => ({
    id: String(data["id"] ?? ""),
    json: String(data["json"] ?? ""),
    requiredAuths: (data["required_auths"] as string[]) ?? [],
    requiredPostingAuths: (data["required_posting_auths"] as string[]) ?? [],
  }));
}

/** Parses a Hive asset string ("1.000 HIVE") into amount + symbol. */
export function parseAsset(asset: string): { amount: number; symbol: string } {
  const [amount, symbol] = asset.trim().split(/\s+/);
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || !symbol) {
    throw new HiveChainError("MALFORMED_RESPONSE", `Invalid Hive asset string: "${asset}"`);
  }
  return { amount: parsed, symbol };
}

/* ------------------------------------------------------------------ *
 * Server-side signing (foundation only — disabled unless configured)
 * ------------------------------------------------------------------ */

/**
 * Loads the server active key from configuration. Never logged, never
 * returned to callers outside this module's broadcast path.
 */
function getServerKey(role: KeyRole = "active"): PrivateKey {
  if (role !== "active") {
    throw new HiveChainError("NOT_CONFIGURED", `No server key configured for role "${role}"`);
  }
  if (!config.hive.activeKey) {
    throw new HiveChainError("NOT_CONFIGURED", "HIVE_ACTIVE_KEY is not configured");
  }
  return PrivateKey.fromString(config.hive.activeKey);
}

/**
 * Broadcasts operations signed with the configured server key.
 * Guarded: throws unless `HIVE_BROADCAST_ENABLED` and credentials are present.
 */
export async function broadcastOperations(
  operations: HiveOperation[],
  role: KeyRole = "active",
): Promise<BroadcastResult> {
  if (!isBroadcastConfigured()) {
    throw new HiveChainError(
      "BROADCAST_DISABLED",
      "Server-side Hive broadcasting is disabled or not configured",
    );
  }
  const key = getServerKey(role);
  const result = await rpc("broadcast.sendOperations", () =>
    getHiveClient().broadcast.sendOperations(operations as never, key),
  );
  return {
    transactionId: String(result.id),
    blockNumber: typeof result.block_num === "number" ? result.block_num : undefined,
    success: true,
    mock: false,
  };
}

/* ------------------------------------------------------------------ *
 * Hive NFT issuance (Hive Engine sidechain)
 *
 * Hive NFTs are issued through the `nft` sidechain contract: a Hive
 * `custom_json` operation carrying the contract call, signed by the USER with
 * their active key (Hive Keychain). This module only PREPARES and READS —
 * signing/broadcasting is `lib/chain/keychain.ts`.
 * ------------------------------------------------------------------ */

/** custom_json id routing an operation to the Hive Engine sidechain. */
export function getSidechainId(): string {
  return config.hive.sidechainId;
}

/** Base JSON-RPC URL of the Hive Engine node used for sidechain reads. */
export function getEngineApi(): string {
  return (config.hive.marketApi ?? "").replace(/\/+$/, "");
}

/**
 * Builds the `nft.issue` contract call for a single token.
 *
 * `contractPayload.symbol` is the PLATFORM Hive Engine NFT symbol; the creator
 * collection symbol lives in `properties.symbol`.
 */
export function buildNftIssueCall(params: NftIssuanceParams): HiveEngineContractCall {
  const symbol = params.symbol.trim().toUpperCase();
  const to = (params.to ?? params.account).trim().toLowerCase();
  assertCanonicalProperties(params.properties as unknown as Record<string, unknown>);
  assertPropertyLimits(params.properties);
  return {
    contractName: "nft",
    contractAction: "issue",
    contractPayload: {
      symbol,
      to,
      feeSymbol: config.hive.nftFeeSymbol,
      fromType: "user",
      toType: "user",
      properties: {
        collection: params.properties.collection,
        symbol: params.properties.symbol,
        metadata: params.properties.metadata,
      },
    },
  };
}

/**
 * Prepares an UNSIGNED NFT issuance. The returned operations are handed to
 * Hive Keychain verbatim — no React/Zustand code ever builds them itself.
 */
export function prepareNftIssuance(params: NftIssuanceParams): PreparedNftIssuance {
  const account = params.account.trim().toLowerCase();
  if (!account) throw new HiveChainError("NOT_CONFIGURED", "No Hive account to sign the mint with");
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol) throw new HiveChainError("NOT_CONFIGURED", "Collection has no Hive NFT symbol");
  if (!params.properties.metadata) {
    throw new HiveChainError("MALFORMED_RESPONSE", "NFT metadata property is empty");
  }
  const to = (params.to ?? account).trim().toLowerCase();
  const call = buildNftIssueCall({ ...params, account, to, symbol });
  const sidechainId = getSidechainId();
  const operations: HiveOperation[] = [
    [
      "custom_json",
      {
        required_auths: [account],
        required_posting_auths: [],
        id: sidechainId,
        json: JSON.stringify(call),
      },
    ],
  ];
  return { account, to, symbol, keyType: "active", sidechainId, call, operations };
}

async function engineRpc<T>(path: string, method: string, params: unknown): Promise<T | null> {
  const endpoint = getEngineApi();
  if (!endpoint) return null;
  try {
    const response = await fetch(`${endpoint}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { result?: T };
    return (body.result ?? null) as T | null;
  } catch (error) {
    logger.warn("BLOCKCHAIN:HIVE", `Hive Engine ${method} failed`, error);
    return null;
  }
}

interface EngineTransactionInfo {
  transactionId: string;
  blockNumber?: number;
  logs?: string;
}

/** Sidechain view of a Hive transaction. `null` until the sidechain indexes it. */
export function getEngineTransaction(txId: TransactionId): Promise<EngineTransactionInfo | null> {
  return engineRpc<EngineTransactionInfo>("blockchain", "getTransactionInfo", { txid: txId });
}

interface EngineLogs {
  errors?: string[];
  events?: { contract: string; event: string; data: Record<string, unknown> }[];
}

function parseEngineLogs(raw: string | undefined): EngineLogs {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as EngineLogs) : {};
  } catch {
    return {};
  }
}

/**
 * Reads the REAL token id created by an issuance transaction.
 * Returns `tokenId: null` while the sidechain has not produced the event yet —
 * the caller must never invent one.
 */
export async function getNftFromTransaction(
  txId: TransactionId,
  expected: { symbol: string; to: string },
): Promise<NftIssuanceOutcome> {
  const base: NftIssuanceOutcome = {
    transactionId: txId,
    tokenId: null,
    symbol: expected.symbol.toUpperCase(),
    to: expected.to.toLowerCase(),
  };
  const info = await getEngineTransaction(txId);
  if (!info) return base;
  const logs = parseEngineLogs(info.logs);
  if (logs.errors?.length) return { ...base, error: logs.errors.join("; ") };
  const issue = (logs.events ?? []).find(
    (event) => event.contract === "nft" && event.event === "issue",
  );
  if (!issue) return base;
  const id = Number(issue.data["id"] ?? issue.data["nftId"] ?? NaN);
  return {
    ...base,
    tokenId: Number.isFinite(id) && id > 0 ? id : null,
    symbol: String(issue.data["symbol"] ?? base.symbol).toUpperCase(),
    to: String(issue.data["to"] ?? base.to).toLowerCase(),
  };
}

/**
 * Polls the sidechain until the issuance is visible.
 * Resolves with `tokenId: null` on timeout so the caller can retry later
 * instead of fabricating an id.
 */
export async function waitForNftIssuance(
  txId: TransactionId,
  expected: { symbol: string; to: string },
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<NftIssuanceOutcome> {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const intervalMs = options?.intervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  let last = await getNftFromTransaction(txId, expected);
  while (Date.now() < deadline) {
    if (last.tokenId !== null || last.error) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    last = await getNftFromTransaction(txId, expected);
  }
  return last;
}

/** Reads one token instance from the NFT contract. */
export async function getNft(symbol: string, tokenId: number): Promise<HiveNftInfo | null> {
  const upper = symbol.trim().toUpperCase();
  const rows = await engineRpc<Record<string, unknown>[]>("contracts", "find", {
    contract: "nft",
    table: `${upper}instances`,
    query: { _id: tokenId },
    limit: 1,
  });
  const row = rows?.[0];
  if (!row) return null;
  return {
    symbol: upper,
    tokenId: Number(row["_id"] ?? tokenId),
    account: String(row["account"] ?? ""),
    properties: (row["properties"] as Record<string, unknown>) ?? {},
  };
}

/** Reads the on-chain definition of an NFT collection symbol. */
export function getNftCollection(symbol: string): Promise<Record<string, unknown> | null> {
  return engineRpc<Record<string, unknown>[]>("contracts", "findOne", {
    contract: "nft",
    table: "nfts",
    query: { symbol: symbol.trim().toUpperCase() },
  }).then((result) => (Array.isArray(result) ? (result[0] ?? null) : (result ?? null)));
}

/* ------------------------------------------------------------------ *
 * REAL issuer-signed NFT issuance (SERVER ONLY)
 *
 * The platform owns ONE Hive NFT collection (PLATFORM_NFT_SYMBOL). Every
 * application collection ("Otters Outbreak") is virtual and identified by the
 * `collection` token property. The issuance is signed by ISSUER_ACCOUNT with
 * ISSUER_KEYS — never by the end user's Keychain, and never in the browser.
 * ------------------------------------------------------------------ */

/** The single Hive NFT symbol the platform issues into (e.g. TESTNFTS). */
export function getPlatformSymbol(): string {
  const symbol = getPlatformNftSymbol();
  if (!symbol) {
    throw new HiveChainError("NOT_CONFIGURED", "PLATFORM_NFT_SYMBOL is not configured");
  }
  return symbol;
}

/** true when ISSUER_ACCOUNT + ISSUER_KEYS + PLATFORM_NFT_SYMBOL are present. */
export function isIssuerReady(): boolean {
  return isIssuerConfigured();
}

/** Configured issuer account, or "" when the issuer is not set up. */
export function getIssuerAccount(): string {
  return config.hive.issuerAccount;
}

export interface IssuerNftIssuanceParams {
  /** Application (virtual) collection name written to the `collection` property. */
  collection: string;
  /** Serialized IPFS metadata document. Must already be a JSON string. */
  metadata: string;
  /** Hive account that receives the token. */
  to: string;
  /** Optional override of the polling window for the token id. */
  confirmTimeoutMs?: number;
}

export interface IssuerNftIssuanceResult extends NftIssuanceOutcome {
  /** Hive account that signed the issuance. */
  issuer: string;
  /** Application collection carried in the token properties. */
  collection: string;
}

/**
 * Issues ONE real NFT on Hive, signed with the issuer's active key.
 *
 * SERVER ONLY — reads ISSUER_KEYS. Never import this from a component.
 * Returns `tokenId: null` when the transaction broadcast but the sidechain has
 * not yet exposed the created token; the caller must recover, never invent one.
 */
export async function issueNftAsIssuer(
  params: IssuerNftIssuanceParams,
): Promise<IssuerNftIssuanceResult> {
  const { account: issuer, key, symbol } = getIssuerCredentials();
  const to = params.to.trim().toLowerCase() || issuer;
  const collection = params.collection.trim();
  if (!collection) {
    throw new HiveChainError("NOT_CONFIGURED", "No application collection name for the issuance");
  }
  if (!params.metadata) {
    throw new HiveChainError("MALFORMED_RESPONSE", "NFT metadata property is empty");
  }

  const properties: HiveNftIssueProperties = { collection, symbol, metadata: params.metadata };
  const issuance = prepareNftIssuance({ account: issuer, to, symbol, properties });

  let signingKey: PrivateKey;
  try {
    signingKey = PrivateKey.fromString(key);
  } catch {
    throw new HiveChainError("NOT_CONFIGURED", "ISSUER_KEYS is not a valid Hive private key");
  }

  logger.info("BLOCKCHAIN:HIVE", "Issuing NFT", { symbol, collection, to, issuer });
  const result = await rpc("broadcast.sendOperations(nft.issue)", () =>
    getHiveClient().broadcast.sendOperations(issuance.operations as never, signingKey),
  );
  const txId = String(result.id);

  const outcome = await waitForNftIssuance(
    txId,
    { symbol, to },
    params.confirmTimeoutMs ? { timeoutMs: params.confirmTimeoutMs } : undefined,
  );
  return { ...outcome, transactionId: txId, issuer, collection };
}
