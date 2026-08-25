// ported from Next.js: 'use server' directive removed

// ─────────────────────────────────────────────────────────────────────────────
// pools.ts — Server Function for fetching Hive Engine liquidity pools
//
// Runs on the server (no /api/* route needed). Called directly from
// pools-client.tsx via SWR — Next.js handles the server boundary automatically.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios'
import { HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const axiosPost = async <T>(url: string, data: unknown): Promise<T> => {
  const res = await axios.post<T>(url, data)
  return res.data
}

const axiosGet = async <T>(url: string): Promise<T> => {
  const res = await axios.get<T>(url)
  return res.data
}

const HE_RPC = HIVE_ENGINE_CONFIG.rpcUrl
const COINGECKO_HIVE = HIVE_ENGINE_CONFIG.coingeckoUrl

interface RawPool {
  _id: number
  tokenPair: string
  baseQuantity: string
  baseVolume: string
  basePrice: string
  quoteQuantity: string
  quoteVolume: string
  quotePrice: string
  totalShares: string
  precision: number
  creator: string
}

interface RawToken {
  symbol: string
  metadata: string
}

interface HERpcResponse<T> {
  result?: T
}

export interface Pool {
  tokenPair: string
  base: string
  quote: string
  baseIcon: string | null
  quoteIcon: string | null
  baseQuantity: string
  quoteQuantity: string
  baseVolume: string
  quoteVolume: string
  basePrice: string
  quotePrice: string
  totalShares: string
  precision: number
  creator: string
  tvlUsd: string
  volumeUsd: string
  hivePriceUsd: number
}

async function fetchAllRawPools(): Promise<RawPool[]> {
  const all: RawPool[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const data = await axiosPost<HERpcResponse<RawPool[]>>(HE_RPC, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'find',
      params: {
        contract: 'marketpools',
        table: 'pools',
        query: {},
        limit,
        offset,
        indexes: [{ index: 'tvl', descending: true }],
      },
    })
    const batch = data.result ?? []
    all.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }

  return all
}

async function fetchTokenIcons(): Promise<Map<string, string | null>> {
  const data = await axiosPost<HERpcResponse<RawToken[]>>(HE_RPC, {
    jsonrpc: '2.0',
    id: Date.now() + 1,
    method: 'find',
    params: {
      contract: 'tokens',
      table: 'tokens',
      query: {},
      limit: 1000,
      indexes: [{ index: '_id', descending: false }],
    },
  })

  const iconMap = new Map<string, string | null>()
  for (const t of data.result ?? []) {
    try {
      const meta = JSON.parse(t.metadata)
      iconMap.set(t.symbol, meta?.icon ?? null)
    } catch {
      iconMap.set(t.symbol, null)
    }
  }
  return iconMap
}

async function fetchHivePriceUsd(): Promise<number> {
  try {
    const data = await axiosGet<{ hive?: { usd?: number } }>(COINGECKO_HIVE)
    return data?.hive?.usd ?? 0
  } catch {
    return 0
  }
}

/** SWR fetcher — called with the static key 'pools' */
export async function fetchPools(): Promise<Pool[]> {
  const [rawPools, iconMap, hivePriceUsd] = await Promise.all([
    fetchAllRawPools(),
    fetchTokenIcons(),
    fetchHivePriceUsd(),
  ])

  // Build a price map: HIVE per 1 unit of token, derived from pools that
  // pair the token with SWAP.HIVE. Picks the deepest such pool for accuracy.
  const hivePerToken = new Map<string, number>()
  hivePerToken.set('SWAP.HIVE', 1)
  const depth = new Map<string, number>()
  for (const p of rawPools) {
    const [base, quote] = p.tokenPair.split(':')
    const bq = parseFloat(p.baseQuantity) || 0
    const qq = parseFloat(p.quoteQuantity) || 0
    if (bq <= 0 || qq <= 0) continue
    // Pool convention: tokens sorted such that SWAP.HIVE side appears; either
    // base or quote may be SWAP.HIVE.
    if (base === 'SWAP.HIVE') {
      const hive = bq
      const price = bq / qq // HIVE per quote token
      if (hive > (depth.get(quote) ?? 0)) {
        depth.set(quote, hive)
        hivePerToken.set(quote, price)
      }
    } else if (quote === 'SWAP.HIVE') {
      const hive = qq
      const price = qq / bq // HIVE per base token
      if (hive > (depth.get(base) ?? 0)) {
        depth.set(base, hive)
        hivePerToken.set(base, price)
      }
    }
  }

  const priceInHive = (sym: string): number => hivePerToken.get(sym) ?? 0

  return rawPools.map((p) => {
    const [base, quote] = p.tokenPair.split(':')
    const baseQty = parseFloat(p.baseQuantity) || 0
    const quoteQty = parseFloat(p.quoteQuantity) || 0
    const baseVol = parseFloat(p.baseVolume) || 0
    const quoteVol = parseFloat(p.quoteVolume) || 0

    const basePxHive = priceInHive(base)
    const quotePxHive = priceInHive(quote)

    // TVL in HIVE: prefer the side we can price. If both priced, sum them
    // (they should be ~equal in an AMM); otherwise double the priced side.
    let tvlHive = 0
    if (basePxHive > 0 && quotePxHive > 0) {
      tvlHive = baseQty * basePxHive + quoteQty * quotePxHive
    } else if (basePxHive > 0) {
      tvlHive = baseQty * basePxHive * 2
    } else if (quotePxHive > 0) {
      tvlHive = quoteQty * quotePxHive * 2
    }

    // Total volume in HIVE: sum both sides priced in HIVE (cumulative).
    const volHive =
      (basePxHive > 0 ? baseVol * basePxHive : 0) +
      (quotePxHive > 0 ? quoteVol * quotePxHive : 0)

    return {
      tokenPair: p.tokenPair,
      base,
      quote,
      baseIcon: iconMap.get(base) ?? null,
      quoteIcon: iconMap.get(quote) ?? null,
      baseQuantity: p.baseQuantity,
      quoteQuantity: p.quoteQuantity,
      baseVolume: p.baseVolume,
      quoteVolume: p.quoteVolume,
      basePrice: p.basePrice,
      quotePrice: p.quotePrice,
      totalShares: p.totalShares,
      precision: p.precision,
      creator: p.creator,
      tvlUsd: (tvlHive * hivePriceUsd).toFixed(2),
      volumeUsd: (volHive * hivePriceUsd).toFixed(2),
      hivePriceUsd,
    }
  })
}

export interface LiquidityPosition {
  account: string
  tokenPair: string
  shares: string
  timeFactor?: number
}

/** Fetch a user's LP positions across all marketpools pools. */
export async function fetchLiquidityPositions(
  username: string,
): Promise<LiquidityPosition[]> {
  if (!username) return []
  const all: LiquidityPosition[] = []
  let offset = 0
  const limit = 100
  while (true) {
    const data = await axiosPost<HERpcResponse<LiquidityPosition[]>>(HE_RPC, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'find',
      params: {
        contract: 'marketpools',
        table: 'liquidityPositions',
        query: { account: username },
        limit,
        offset,
      },
    })
    const batch = data.result ?? []
    all.push(...batch)
    if (batch.length < limit) break
    offset += limit
  }
  return all
}

/** Fetch all liquidity positions (contributors) for a specific tokenPair. */
export async function fetchPoolLiquidityPositions(
  tokenPair: string,
  limit = 100,
): Promise<LiquidityPosition[]> {
  if (!tokenPair) return []
  const data = await axiosPost<HERpcResponse<LiquidityPosition[]>>(HE_RPC, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'find',
    params: {
      contract: 'marketpools',
      table: 'liquidityPositions',
      query: { tokenPair },
      limit,
      offset: 0,
      indexes: [{ index: 'shares', descending: true }],
    },
  })
  return data.result ?? []
}
