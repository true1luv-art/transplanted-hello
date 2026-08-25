"use client";

import type {
  ClaimResult,
  ChestResult,
  ItemDto,
  MarketListingDto,
  LogDto,
  PendingTxDto,
  SettledTxDto,
  PlayerDto,
  RaidResult,
  TickResult,
  UpgradeResult,
} from "./types";

export class ApiError extends Error {
  constructor(
    public override message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let token: string | null = null;
let demoMode = false;

/**
 * Demo mode plays entirely on local (zustand/localStorage) state: every request
 * short-circuits so the stores fall back to their offline code paths.
 */
export function setDemoMode(value: boolean) {
  demoMode = value;
  if (typeof localStorage !== "undefined") {
    if (value) localStorage.setItem("cryptocore.demo", "1");
    else localStorage.removeItem("cryptocore.demo");
  }
}

export function isDemoMode(): boolean {
  if (!demoMode && typeof localStorage !== "undefined") {
    demoMode = localStorage.getItem("cryptocore.demo") === "1";
  }
  return demoMode;
}

export function setAuthToken(newToken: string | null) {
  token = newToken;
  if (newToken) {
    localStorage.setItem("cryptocore.token", newToken);
  } else {
    localStorage.removeItem("cryptocore.token");
  }
}

export function loadAuthToken(): string | null {
  if (!token) {
    token = localStorage.getItem("cryptocore.token");
  }
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (isDemoMode()) throw new ApiError("Demo mode", 0);
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const currentToken = loadAuthToken();
  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message || response.statusText, response.status);
  }

  return (await response.json()) as T;
}

export async function generateChallenge(
  wallet: string,
): Promise<{ ok: boolean; nonce?: string; error?: string }> {
  try {
    return await request<{ ok: boolean; nonce: string }>("/api/auth/challenge", {
      method: "POST",
      body: JSON.stringify({ wallet }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function verifySignature(
  wallet: string,
  signature: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    return await request<{ ok: boolean; token: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ wallet, signature }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function getMe(): Promise<{ ok: boolean; player?: PlayerDto; error?: string }> {
  try {
    return await request<{ ok: boolean; player: PlayerDto }>("/api/player/me", { method: "GET" });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function updateProfile(
  username: string,
): Promise<{ ok: boolean; player?: PlayerDto; error?: string }> {
  try {
    return await request<{ ok: boolean; player: PlayerDto }>("/api/player/me", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function tick(): Promise<TickResult> {
  try {
    return await request<TickResult>("/api/game/tick", { method: "POST" });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function claim(): Promise<ClaimResult> {
  try {
    return await request<ClaimResult>("/api/game/claim", { method: "POST" });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function buyCosmetic(templateId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    return await request<{ ok: boolean }>("/api/game/cosmetics/buy", {
      method: "POST",
      body: JSON.stringify({ templateId }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function openChest(chest: string, seed: string): Promise<ChestResult> {
  try {
    return await request<ChestResult>("/api/game/chest", {
      method: "POST",
      body: JSON.stringify({ chest, seed }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function upgradeStat(stat: string, levels = 1): Promise<UpgradeResult> {
  try {
    return await request<UpgradeResult>("/api/game/upgrade/stat", {
      method: "POST",
      body: JSON.stringify({ stat, levels }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function upgradeItem(itemNumber: number): Promise<UpgradeResult> {
  try {
    return await request<UpgradeResult>("/api/game/upgrade/item", {
      method: "POST",
      body: JSON.stringify({ itemNumber }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function burn(amount: number): Promise<UpgradeResult> {
  try {
    return await request<UpgradeResult>("/api/game/burn", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

/** Stakes HASH into the vault (Luck/Firewall) — distinct from burn() (Notoriety/Exploit). */
export async function stakeVault(amount: number): Promise<UpgradeResult> {
  try {
    return await request<UpgradeResult>("/api/game/vault/stake", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function getRaidTargets(
  hackPower: number,
): Promise<{ ok: boolean; rivals?: import("@/features/types/game").Rival[]; error?: string }> {
  try {
    return await request<{ ok: boolean; rivals: import("@/features/types/game").Rival[] }>(
      `/api/game/raid/targets?defense=${hackPower}`,
      { method: "GET" },
    );
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function raid(target: string, seed: string): Promise<RaidResult> {
  try {
    return await request<RaidResult>("/api/game/raid", {
      method: "POST",
      body: JSON.stringify({ target, seed }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function getInventory(): Promise<{ ok: boolean; items?: ItemDto[]; error?: string }> {
  try {
    return await request<{ ok: boolean; items: ItemDto[] }>("/api/items", { method: "GET" });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function equipItem(
  itemNumber: number,
): Promise<{ ok: boolean; item?: ItemDto; error?: string }> {
  try {
    return await request<{ ok: boolean; item: ItemDto }>("/api/items/equip", {
      method: "POST",
      body: JSON.stringify({ itemNumber }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function unequipItem(
  itemNumber: number,
): Promise<{ ok: boolean; item?: ItemDto; error?: string }> {
  try {
    return await request<{ ok: boolean; item: ItemDto }>("/api/items/unequip", {
      method: "POST",
      body: JSON.stringify({ itemNumber }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function salvageItem(
  itemNumber: number,
): Promise<{ ok: boolean; item?: ItemDto; error?: string }> {
  try {
    return await request<{ ok: boolean; item: ItemDto }>("/api/items/salvage", {
      method: "POST",
      body: JSON.stringify({ itemNumber }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

/**
 * Public market listings. Deliberately NOT gated behind demo mode: demo players
 * browse the same real listings, they just cannot buy or sell.
 */
export async function getMarketListings(): Promise<{
  ok: boolean;
  listings?: MarketListingDto[];
  error?: string;
}> {
  try {
    const response = await fetch("/api/market", {
      headers: { "Content-Type": "application/json" },
      ...(typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
        ? { signal: AbortSignal.timeout(8000) }
        : {}),
    });
    if (!response.ok) {
      return { ok: false, error: `Server error (${response.status})` };
    }
    return (await response.json()) as { ok: boolean; listings: MarketListingDto[] };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function listMarketItem(
  kind: "asset" | "item",
  refId: number,
  price: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await request<{ ok: boolean }>("/api/market/list", {
      method: "POST",
      body: JSON.stringify({ kind, refId, price }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function buyMarketItem(
  kind: "asset" | "item",
  refId: number,
  paymentTxId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await request<{ ok: boolean }>("/api/market/buy", {
      method: "POST",
      body: JSON.stringify({ kind, refId, paymentTxId }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function cancelMarketListing(
  kind: "asset" | "item",
  refId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await request<{ ok: boolean }>("/api/market/cancel", {
      method: "POST",
      body: JSON.stringify({ kind, refId }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

type LogsResponse = { ok: boolean; logs?: LogDto[]; error?: string };

async function fetchLogs(path: string): Promise<LogsResponse> {
  try {
    return await request<{ ok: boolean; logs: LogDto[] }>(path, { method: "GET" });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

/** The signed-in player's gameplay activity feed (claims, chests, raids, upgrades). */
export function getActivityLogs(limit = 50): Promise<LogsResponse> {
  return fetchLogs(`/api/logs?limit=${limit}`);
}

/** The signed-in player's marketplace trades (bought / sold / listed / cancelled). */
export function getMyMarketLogs(limit = 50): Promise<LogsResponse> {
  return fetchLogs(`/api/logs/market?limit=${limit}`);
}

/** The signed-in player's marketplace trades filtered by kind ("item" or "asset"). */
export function getMyMarketLogsByKind(kind: "item" | "asset", limit = 50): Promise<LogsResponse> {
  return fetchLogs(`/api/logs/market?kind=${kind}&limit=${limit}`);
}

/** Public history of completed marketplace sales. */
export function getMarketSales(limit = 25): Promise<LogsResponse> {
  return fetchLogs(`/api/logs/market/sales?limit=${limit}`);
}

/** Public history of completed marketplace sales filtered by kind ("item" or "asset"). */
export function getMarketSalesByKind(kind: "item" | "asset", limit = 25): Promise<LogsResponse> {
  return fetchLogs(`/api/logs/market/sales?kind=${kind}&limit=${limit}`);
}

/**
 * Submits proof of an on-chain HASH token transfer to the treasury. The
 * server queues it; the settlement worker verifies the transaction on-chain
 * before crediting the player's in-game balance.
 */
export async function deposit(
  txId: string,
  amount: number,
): Promise<{
  ok: boolean;
  queued?: boolean;
  jobId?: string;
  txId?: string;
  amount?: number;
  error?: string;
}> {
  try {
    return await request<{
      ok: boolean;
      queued: boolean;
      jobId: string;
      txId: string;
      amount: number;
    }>("/api/game/deposit", {
      method: "POST",
      body: JSON.stringify({ txId, amount }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

export async function withdraw(amount: number): Promise<{
  ok: boolean;
  queued?: boolean;
  jobId?: string;
  signature?: string;
  amount?: number;
  remaining?: number;
  dailyCap?: number;
  resetAt?: number;
  error?: string;
}> {
  try {
    return await request<{
      ok: boolean;
      queued: boolean;
      jobId: string;
      signature: string;
      amount: number;
    }>("/api/game/withdrawal", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

/**
 * Asks the server to build an unsigned player -> treasury HASH token
 * transfer transaction (base64). The caller deserialises it, has the
 * connected wallet sign + broadcast it, then reports the signature back
 * for settlement. Building the tx server-side means the browser never
 * talks to Solana RPC directly.
 */
export async function buildDepositTx(amount: number): Promise<{
  ok: boolean;
  transaction?: string;
  decimals?: number;
  error?: string;
}> {
  try {
    return await request<{ ok: boolean; transaction: string; decimals: number }>(
      "/api/wallet/build-tx",
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      },
    );
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

/** The signed-in wallet's real on-chain HASH token balance, read server-side. */
export async function getWalletBalance(): Promise<{
  ok: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    return await request<{ ok: boolean; balance: number }>("/api/wallet/balance", {
      method: "GET",
    });
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}

/**
 * The treasury's real on-chain HASH token balance. This is public on-chain
 * information and unauthenticated server-side, so — unlike everything else
 * here that goes through request() — it's fetched directly rather than
 * gated behind isDemoMode(): the vault size is real and worth showing even
 * while a player is browsing in a demo session.
 */
export async function getTreasuryBalance(): Promise<{
  ok: boolean;
  balance?: number;
  error?: string;
}> {
  try {
    const response = await fetch("/api/wallet/treasury-balance", { method: "GET" });
    if (!response.ok) {
      return { ok: false, error: response.statusText };
    }
    return (await response.json()) as { ok: boolean; balance: number };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function getTransactions(limit = 25): Promise<{
  ok: boolean;
  pending?: PendingTxDto[];
  history?: SettledTxDto[];
  error?: string;
}> {
  try {
    return await request<{ ok: boolean; pending: PendingTxDto[]; history: SettledTxDto[] }>(
      `/api/transactions?limit=${limit}`,
      { method: "GET" },
    );
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : "Network error" };
  }
}
