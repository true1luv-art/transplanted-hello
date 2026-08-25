/**
 * lib/config/api.ts
 *
 * All external API endpoint URLs used across the app.
 * Import from here instead of hardcoding URLs in fetchers or components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Hive API
// ─────────────────────────────────────────────────────────────────────────────

export const HIVE_CONFIG = {
  /** Primary JSON-RPC endpoint */
  apiUrl: "https://api.hive.blog/",

  /** Hive image proxy base — append /{username}/avatar or /cover */
  imageProxyUrl: "https://images.hive.blog",

  /** External explorer base for user profiles */
  peakdUrl: "https://peakd.com",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Hive Engine API endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const HIVE_ENGINE_CONFIG = {
  /** Main contracts RPC — used for tokens, pools, market, open-orders */
  rpcUrl: "https://enginerpc.com/contracts",

  /** Alternate contracts endpoint used for swap/trade queries */
  apiUrl: "https://api.hive-engine.com/rpc/contracts",

  /** Account history endpoint — per-account HE transaction history */
  historyUrl: "https://history.hive-engine.com",

  /** Account-level history endpoint */
  accountHistoryUrl: "https://accounts.hive-engine.com/accountHistory",

  /** CoinGecko simple-price endpoint for HIVE/USD */
  coingeckoUrl: "https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd",

  /** Token icon CDN base — append /{symbol}.png */
  iconBaseUrl: "https://images.hive-engine.com/token-icons",
} as const;
