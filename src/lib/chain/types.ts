/**
 * Shared Hive / Keychain blockchain types.
 *
 * Scope: blockchain integration primitives only.
 * - Application contracts live in `src/features/types/`.
 * - MongoDB document types live in `src/lib/modules/{collection}/types.ts`.
 *
 * dHive already ships accurate types for accounts, blocks and dynamic global
 * properties; those are re-exported here rather than duplicated.
 */
import type {
  Account as HiveAccount,
  DynamicGlobalProperties,
  SignedTransaction,
  Transaction as HiveTransaction,
} from "@hiveio/dhive";

export type { HiveAccount, HiveTransaction, SignedTransaction, DynamicGlobalProperties };

/** 40-char hex Hive transaction id. */
export type TransactionId = string;

/** A single Hive operation, e.g. `["transfer", { ... }]`. */
export type HiveOperation = [string, Record<string, unknown>];

/** Hive key authority levels. */
export type KeyRole = "posting" | "active" | "memo" | "owner";

/** Normalized transfer operation payload. */
export interface TransferOperationData {
  from: string;
  to: string;
  /** Asset string as broadcast, e.g. "1.000 HIVE". */
  amount: string;
  memo: string;
}

/** Normalized custom_json operation payload. */
export interface CustomJsonOperationData {
  id: string;
  json: string;
  requiredAuths: string[];
  requiredPostingAuths: string[];
}

/**
 * A single operation flattened into the generic shape the backend inspects.
 * Deliberately business-agnostic: no NFT/collection/marketplace semantics.
 */
export interface NormalizedOperation {
  /** Operation type without the `_operation` suffix, e.g. "transfer". */
  type: string;
  /** Raw operation payload exactly as broadcast. */
  data: Record<string, unknown>;
  /** Account that initiated the operation, when the type exposes one. */
  sender?: string | undefined;
  /** Counterparty account, when the type exposes one. */
  recipient?: string | undefined;
  /** Numeric amount, when the operation carries an asset. */
  amount?: number | undefined;
  /** Asset symbol ("HIVE" / "HBD"), when the operation carries an asset. */
  symbol?: string | undefined;
  /** Transfer memo or custom_json payload string, when present. */
  memo?: string | undefined;
}

/** Result of looking up a transaction on chain. */
export interface TransactionInfo {
  transactionId: TransactionId;
  blockNumber: number;
  transactionNumber: number;
  /** Block timestamp in ISO form when the node reports one. */
  timestamp?: string | undefined;
  expiration: string;
  operations: HiveOperation[];
  /** Generic per-operation view used by server/smart-contract verification. */
  normalizedOperations: NormalizedOperation[];
}

/** Origin of a transaction identifier tracked by the backend. */
export type TransactionIdKind = "hive" | "mock" | "application" | "unknown";

/** Result of a backend Hive connectivity probe. Never contains secrets. */
export interface HiveConnectionStatus {
  connected: boolean;
  network: string;
  node: string;
  nodes: number;
  headBlock?: number | undefined;
  /** Round-trip time of the probe, ms. */
  latencyMs?: number | undefined;
  error?: string | undefined;
}

/** Result of a backend Hive account probe. Never contains keys. */
export interface HiveAccountStatus {
  configured: boolean;
  account: string;
  exists: boolean;
  error?: string | undefined;
}

/** Lifecycle status of a chain transaction as tracked by the backend. */
export type TransactionStatus = "pending" | "confirmed" | "failed" | "not_found";

/** Outcome of a broadcast performed by either the server or Keychain. */
export interface BroadcastResult {
  transactionId: TransactionId;
  blockNumber?: number | undefined;
  success: boolean;
  /** true when produced by a mock implementation rather than a real chain. */
  mock: boolean;
}

/* ------------------------------------------------------------------ *
 * Hive Keychain (browser extension) transport types
 * ------------------------------------------------------------------ */

/** Generic Keychain request accepted by the transport layer. */
export interface KeychainBroadcastRequest {
  account: string;
  operations: HiveOperation[];
  keyType: KeyRole;
}

export interface KeychainTransferRequest {
  account: string;
  to: string;
  /** Numeric amount; formatted to 3 decimals by the adapter. */
  amount: number | string;
  currency: "HIVE" | "HBD";
  memo?: string;
  keyType?: Extract<KeyRole, "active" | "posting">;
}

export interface KeychainCustomJsonRequest {
  account: string;
  id: string;
  json: Record<string, unknown> | string;
  keyType: Extract<KeyRole, "active" | "posting">;
  displayName?: string;
}

export interface KeychainSignBufferRequest {
  account: string;
  message: string;
  keyType: KeyRole;
}

/** Raw response shape returned by the Hive Keychain extension. */
export interface KeychainRawResponse {
  success: boolean;
  error?: unknown;
  message?: string;
  result?: unknown;
  data?: Record<string, unknown>;
  request_id?: number;
}

/** Normalized Keychain response used across the app. */
export interface KeychainResponse<T = unknown> {
  success: boolean;
  message: string;
  result: T | null;
  /** Transaction id when the operation was broadcast. */
  transactionId?: TransactionId | undefined;
  raw: KeychainRawResponse;
}

/* ------------------------------------------------------------------ *
 * Hive account profile metadata
 * ------------------------------------------------------------------ */

/**
 * Raw `profile` object found inside a Hive account's
 * `posting_json_metadata` (preferred) or legacy `json_metadata`.
 * All fields are optional — accounts may publish any subset.
 */
export interface HiveProfileMetadata {
  name?: string;
  about?: string;
  /** Avatar override published by the account. */
  profile_image?: string;
  /** Profile banner / background image. */
  cover_image?: string;
  location?: string;
  website?: string;
}

/**
 * Normalized, application-friendly view of a Hive account profile.
 * Derived from chain data — never authored by the application.
 */
export interface HiveAccountProfile {
  /** Hive account name: the canonical blockchain identity. */
  username: string;
  displayName?: string | undefined;
  about?: string | undefined;
  /** Always derivable: https://images.hive.blog/u/{username}/avatar */
  avatarUrl: string;
  /** Avatar published in account metadata, when present. */
  profileImage?: string | undefined;
  /** Banner / background image published in account metadata. */
  coverImage?: string | undefined;
  location?: string | undefined;
  website?: string | undefined;
}

/* ------------------------------------------------------------------ *
 * Hive NFT issuance (Hive Engine sidechain, user-signed via Keychain)
 * ------------------------------------------------------------------ */

/** Canonical, chain-facing NFT properties. Every value is a STRING. */
export interface HiveNftIssueProperties {
  collection: string;
  symbol: string;
  /** Serialized IPFS metadata document (JSON string). */
  metadata: string;
}

/** Everything the chain layer needs to build an NFT issuance operation. */
export interface NftIssuanceParams {
  /** Hive account that signs and pays — always the connected user. */
  account: string;
  /** Recipient of the token; defaults to `account`. */
  to?: string;
  /** Collection symbol registered on the NFT contract. */
  symbol: string;
  properties: HiveNftIssueProperties;
}

/** Hive Engine contract call carried inside a `custom_json` operation. */
export interface HiveEngineContractCall {
  contractName: string;
  contractAction: string;
  contractPayload: Record<string, unknown>;
}

/** A prepared (unsigned) issuance, ready to hand to Hive Keychain. */
export interface PreparedNftIssuance {
  account: string;
  to: string;
  symbol: string;
  keyType: Extract<KeyRole, "active" | "posting">;
  /** custom_json id, e.g. `ssc-mainnet-hive`. */
  sidechainId: string;
  call: HiveEngineContractCall;
  operations: HiveOperation[];
}

/** A token as reported by the Hive Engine NFT contract. */
export interface HiveNftInfo {
  symbol: string;
  /** REAL blockchain token id. */
  tokenId: number;
  account: string;
  properties: Record<string, unknown>;
}

/** Outcome of resolving a broadcast issuance against the sidechain. */
export interface NftIssuanceOutcome {
  transactionId: TransactionId;
  /** null when the sidechain has not yet exposed the created token. */
  tokenId: number | null;
  symbol: string;
  to: string;
  /** Sidechain error string when the contract rejected the call. */
  error?: string | undefined;
}

/** Lifecycle of a local mint transaction record. */
export type MintTransactionStatus =
  | "pending"
  | "signing"
  | "broadcasted"
  | "confirmed"
  | "failed"
  | "rejected";

/** Keychain issuance request accepted by the transport layer. */
export interface KeychainNftIssueRequest {
  issuance: PreparedNftIssuance;
}
