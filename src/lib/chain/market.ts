/**
 * Hive market reads.
 *
 * HiveMint does NOT run its own NFT marketplace: Hive (Hive Engine's NFT
 * market) owns listings, bids and sales. This module is the read side of that
 * relationship — the application asks Hive what the market state of a token is
 * and caches the answer on the `nfts` index for fast UI/API lookups.
 *
 *   Hive market (authoritative) -> fetchHiveListing() -> nfts.isListed (cache)
 *
 * SERVER-ONLY. Never mutates anything.
 */
import { config } from "@/lib/config/config";

export interface HiveMarketListing {
  /** `SYMBOL:tokenId` */
  hiveNftId: string;
  symbol: string;
  tokenId: number;
  seller: string;
  price: number;
  currency: "HIVE";
  /** ISO timestamp reported by the market, when available */
  listedAt?: string | undefined;
}

export interface HiveMarketQuery {
  symbol: string;
  tokenId: number;
}

const endpoint = () => config.hive.marketApi ?? "";

/**
 * Current market state of one token. Returns null when the token is not
 * listed, and null in mock mode (Phase 6 keeps the frontend on the mock
 * system — the cached index is used instead).
 */
export async function fetchHiveListing(query: HiveMarketQuery): Promise<HiveMarketListing | null> {
  if (config.blockchainDriver !== "hive" || !endpoint()) return null;

  const response = await fetch(`${endpoint()}/contracts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "find",
      params: {
        contract: "nftmarket",
        table: `${query.symbol.toUpperCase()}sellBook`,
        query: { nftId: String(query.tokenId) },
        limit: 1,
      },
    }),
  });
  if (!response.ok) return null;

  const body = (await response.json()) as { result?: MarketRow[] };
  const row = body.result?.[0];
  if (!row) return null;

  return {
    hiveNftId: `${query.symbol.toUpperCase()}:${query.tokenId}`,
    symbol: query.symbol.toUpperCase(),
    tokenId: query.tokenId,
    seller: row.account,
    price: Number(row.price),
    currency: "HIVE",
    listedAt: row.timestamp ? new Date(row.timestamp).toISOString() : undefined,
  };
}

interface MarketRow {
  account: string;
  price: string | number;
  timestamp?: number;
}
