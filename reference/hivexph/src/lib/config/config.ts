/**
 * lib/config/config.ts
 *
 * Single source of truth for all application-wide configuration.
 * Import from here instead of hardcoding values across the codebase.
 *
 * External API URLs live in lib/config/api.ts — import from there directly.
 * Re-exported here for backwards compatibility.
 */

export { HIVE_CONFIG, HIVE_ENGINE_CONFIG } from "@/lib/config/api";

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

export const APP_CONFIG = {
  name: "HiveX PH",
  domain: "https://hivep2p.com",
  email: "admin@hivep2p.com",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Offer activation
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIVATION_CONFIG = {
  /**
   * The Hive account that receives the activation transfer.
   * Users send exactly `activationAmount` HIVE to this account to activate
   * their offers for `windowHours` hours.
   */
  watchAccount: "dvpm01",

  /** Amount string passed to requestTransfer — must be exactly 3 decimal places */
  activationAmount: "1.000",

  /** Currency for the activation transfer */
  activationCurrency: "HIVE",

  /** Human-readable label used in UI e.g. "1.000 HIVE" */
  get activationLabel() { return `${this.activationAmount} ${this.activationCurrency}`; },

  /** How many hours an activation window lasts */
  windowHours: 24,

  /**
   * How many recent account-history ops to scan when looking for activations.
   * Increase if the watch account has high transfer volume.
   */
  historyLimit: 100,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// P2P tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical list of tokens supported by the P2P marketplace.
 * Used in the offer create dialog, p2p filter dropdowns, and landing page stats.
 */
export const P2P_TOKENS = [
  { symbol: "HIVE", name: "Hive", layer: 1 },
  { symbol: "SWAP.HIVE", name: "Swap Hive", layer: 2 },
  { symbol: "HBD", name: "Hive Dollars", layer: 1 },
  { symbol: "DEC", name: "Dark Energy", layer: 2 },
  { symbol: "SPS", name: "Splintershards", layer: 2 },
] as const;

export type P2PTokenSymbol = typeof P2P_TOKENS[number]["symbol"];

/** Convenience array of just the symbol strings */
export const P2P_TOKEN_SYMBOLS = P2P_TOKENS.map((t) => t.symbol);

// ─────────────────────────────────────────────────────────────────────────────
// Payment methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preset payment methods shown in the p2p filter and account settings modal.
 * Add new options here — they will appear everywhere automatically.
 */
export const PAYMENT_METHODS = [
  "GCash",
  "Maya",
  "Bank Transfer",
  "BDO",
  "BPI",
  "UnionBank",
  "Metrobank",
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralised storage key names to prevent typo-driven key mismatches
 * across localStorage and sessionStorage usage.
 */
export const STORAGE_KEYS = {
  theme: "hivep2p-theme",
  accounts: "hivep2p-accounts",
} as const;
