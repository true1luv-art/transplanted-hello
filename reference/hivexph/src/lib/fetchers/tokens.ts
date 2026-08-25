// ported from Next.js: 'use server' directive removed

import axios from 'axios'
import { HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const HE_RPC = HIVE_ENGINE_CONFIG.rpcUrl
const COINGECKO = HIVE_ENGINE_CONFIG.coingeckoUrl
const PAGE_SIZE = 1000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenRow {
  symbol: string
  name: string
  icon: string | null
  issuer: string
  precision: number
  maxSupply: string
  circulatingSupply: string
  lastPrice: string
  lastPriceUsd: string
  volume: string
  volumeUsd: string
  priceChangePercent: string
  priceChangeHive: string
  lowestAsk: string
  highestBid: string
  marketCap: string
  marketCapUsd: string
  hivePriceUsd: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function hePost<T>(params: object): Promise<T[]> {
  const res = await axios.post<{ result: T[] }>(HE_RPC, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'find',
    params,
  })
  return res.data?.result ?? []
}

async function fetchAllPages<T>(
  contract: string,
  table: string,
  query: Record<string, unknown> = {},
  indexes: Array<{ index: string; descending: boolean }> = [],
): Promise<T[]> {
  const results: T[] = []
  let offset = 0
  while (true) {
    const page = await hePost<T>({ contract, table, query, limit: PAGE_SIZE, offset, indexes })
    results.push(...page)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return results
}

// ── All tokens (no market filter) ─────────────────────────────────────────────

export interface BasicToken {
  symbol: string
  name: string
  icon: string | null
  precision: number
  issuer: string
}

export async function fetchAllTokens(): Promise<BasicToken[]> {
  const raw = await fetchAllPages<{
    symbol: string; name: string; metadata: string; issuer: string; precision: number
  }>('tokens', 'tokens', {}, [{ index: '_id', descending: false }])

  return raw.map((t) => {
    let icon: string | null = null
    try { icon = JSON.parse(t.metadata)?.icon ?? null } catch { /* */ }
    return {
      symbol: t.symbol,
      name: t.name,
      icon,
      precision: t.precision,
      issuer: t.issuer,
    }
  })
}

// ── Server Function ───────────────────────────────────────────────────────────

export async function fetchTokens(): Promise<TokenRow[]> {
  const [tokens, metrics, hivePriceData] = await Promise.all([
    fetchAllPages<{
      symbol: string; name: string; metadata: string; issuer: string
      precision: number; maxSupply: string; circulatingSupply: string
    }>('tokens', 'tokens', {}, [{ index: '_id', descending: false }]),

    fetchAllPages<{
      symbol: string; lastPrice: string; volume: string; volumeExpiration: number
      priceChangePercent: string; priceChangeHive: string; lowestAsk: string
      highestBid: string; lastDayPrice: string; lastDayPriceExpiration: number
    }>('market', 'metrics', {}, [{ index: 'volume', descending: true }]),

    axios.get<{ hive: { usd: number } }>(COINGECKO).then(r => r.data).catch(() => ({ hive: { usd: 0 } })),
  ])

  const hivePrice = hivePriceData?.hive?.usd ?? 0
  const nowSecs = Math.floor(Date.now() / 1000)
  const tokensBySymbol = Object.fromEntries(tokens.map(t => [t.symbol, t]))

  return metrics
    .filter(m => tokensBySymbol[m.symbol])
    .map(m => {
      const t = tokensBySymbol[m.symbol]
      let icon: string | null = null
      try { icon = JSON.parse(t.metadata)?.icon ?? null } catch { /* no icon */ }

      const price = parseFloat(m.lastPrice) || 0
      const supply = parseFloat(t.circulatingSupply) || 0
      const marketCap = price * supply
      const volumeActive = m.volumeExpiration > nowSecs
      const dayPriceActive = m.lastDayPriceExpiration > nowSecs

      return {
        symbol: t.symbol,
        name: t.name,
        icon,
        issuer: t.issuer,
        precision: t.precision,
        maxSupply: t.maxSupply,
        circulatingSupply: t.circulatingSupply,
        lastPrice: m.lastPrice,
        lastPriceUsd: (price * hivePrice).toFixed(8),
        volume: volumeActive ? m.volume : '0',
        volumeUsd: (parseFloat(volumeActive ? m.volume : '0') * hivePrice).toFixed(2),
        priceChangePercent: dayPriceActive ? m.priceChangePercent : '0%',
        priceChangeHive: dayPriceActive ? m.priceChangeHive : '0',
        lowestAsk: m.lowestAsk,
        highestBid: m.highestBid,
        marketCap: marketCap.toFixed(8),
        marketCapUsd: (marketCap * hivePrice).toFixed(2),
        hivePriceUsd: hivePrice,
      }
    })
    .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
}
