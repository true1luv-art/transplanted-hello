// ported from Next.js: 'use server' directive removed

import axios from 'axios'
import { HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const HE_RPC = HIVE_ENGINE_CONFIG.rpcUrl
const HE_API = HIVE_ENGINE_CONFIG.apiUrl
const HE_HISTORY = HIVE_ENGINE_CONFIG.historyUrl
const COINGECKO = HIVE_ENGINE_CONFIG.coingeckoUrl

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenListItem {
  symbol: string
  name: string
  icon: string | null
  issuer: string
  precision: number
  maxSupply: string
  circulatingSupply: string
  lastPrice: string
  volume: string
  priceChangePercent: string
}

export interface MarketData {
  metrics: {
    symbol: string; lastPrice: string; volume: string; volumeExpiration: number
    priceChangePercent: string; priceChangeHive: string; lowestAsk: string
    highestBid: string; lastDayPrice: string; lastDayPriceExpiration: number
  } | null
  tokenInfo: {
    symbol: string; name: string; metadata: string; precision: number
    circulatingSupply: string; maxSupply: string; issuer: string
  } | null
  buyBook: OpenOrder[]
  sellBook: OpenOrder[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ohlcv: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tradesHistory: any[]
  hivePriceUsd: number
}

export interface OpenOrder {
  _id: number
  txId: string
  timestamp: number
  account: string
  symbol: string
  quantity: string
  price: string
  expiration: number
  side: 'buy' | 'sell'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function heRpcPost<T>(endpoint: string, method: string, params: object): Promise<T | null> {
  const res = await axios.post<{ result: T }>(endpoint, { jsonrpc: '2.0', id: Date.now(), method, params })
  return res.data?.result ?? null
}

// ── Server Functions ──────────────────────────────────────────────────────────

export async function fetchTradeTokens(): Promise<TokenListItem[]> {
  const [tokens, metrics] = await Promise.all([
    heRpcPost<Array<{ symbol: string; name: string; metadata: string; issuer: string; precision: number; maxSupply: string; circulatingSupply: string }>>(
      HE_RPC, 'find', { contract: 'tokens', table: 'tokens', query: {}, limit: 1000, indexes: [{ index: '_id', descending: false }] }
    ),
    heRpcPost<Array<{ symbol: string; lastPrice: string; volume: string; priceChangePercent: string; priceChangeHive: string }>>(
      HE_RPC, 'find', { contract: 'market', table: 'metrics', query: {}, limit: 1000, indexes: [{ index: '_id', descending: false }] }
    ),
  ])

  const metricsBySymbol = Object.fromEntries((metrics ?? []).map(m => [m.symbol, m]))

  return (tokens ?? [])
    .filter(t => metricsBySymbol[t.symbol])
    .map(t => {
      let icon: string | null = null
      try { icon = JSON.parse(t.metadata)?.icon ?? null } catch { /* */ }
      return {
        symbol: t.symbol, name: t.name, icon, issuer: t.issuer,
        precision: t.precision, maxSupply: t.maxSupply, circulatingSupply: t.circulatingSupply,
        lastPrice: metricsBySymbol[t.symbol]?.lastPrice ?? '0',
        volume: metricsBySymbol[t.symbol]?.volume ?? '0',
        priceChangePercent: metricsBySymbol[t.symbol]?.priceChangePercent ?? '0.00%',
      }
    })
}

export async function fetchTradeMarket(symbol: string): Promise<MarketData> {
  const sym = symbol.toUpperCase()

  const [hivePriceUsd, metrics, tokenInfo, buyBook, sellBook, ohlcv, tradesHistory] = await Promise.all([
    axios.get<{ hive: { usd: number } }>(COINGECKO).then(r => r.data?.hive?.usd ?? 0).catch(() => 0),
    heRpcPost(HE_API, 'findOne', { contract: 'market', table: 'metrics', query: { symbol: sym } }),
    heRpcPost(HE_API, 'findOne', { contract: 'tokens', table: 'tokens', query: { symbol: sym } }),
    heRpcPost(HE_API, 'find', { contract: 'market', table: 'buyBook', query: { symbol: sym }, limit: 50, offset: 0, indexes: [{ index: 'priceDec', descending: true }] }),
    heRpcPost(HE_API, 'find', { contract: 'market', table: 'sellBook', query: { symbol: sym }, limit: 50, offset: 0, indexes: [{ index: 'priceDec', descending: false }] }),
    axios.get(`${HE_HISTORY}/marketHistory?symbol=${sym}&timestampStart=${Math.floor(Date.now() / 1000) - 86400 * 30}&timestampEnd=${Math.floor(Date.now() / 1000)}`).then(r => r.data).catch(() => []),
    heRpcPost<unknown[]>(HE_RPC, 'find', { contract: 'market', table: 'tradesHistory', query: { symbol: sym }, limit: 30, offset: 0, indexes: [{ index: '_id', descending: true }] }),
  ])

  return {
    metrics: metrics as MarketData['metrics'],
    tokenInfo: tokenInfo as MarketData['tokenInfo'],
    buyBook: (buyBook as OpenOrder[] | null) ?? [],
    sellBook: (sellBook as OpenOrder[] | null) ?? [],
    ohlcv: (ohlcv as unknown[]) ?? [],
    tradesHistory: tradesHistory ?? [],
    hivePriceUsd: hivePriceUsd as number,
  }
}

export async function fetchOpenOrders(username: string, symbol: string): Promise<{ orders: OpenOrder[] }> {
  const account = username.toLowerCase()
  const sym = symbol.toUpperCase()

  const [buyRaw, sellRaw] = await Promise.all([
    heRpcPost<Omit<OpenOrder, 'side'>[]>(HE_RPC, 'find', {
      contract: 'market', table: 'buyBook', query: { account, symbol: sym },
      indexes: [{ index: 'priceDec', descending: false }], limit: 1000, offset: 0,
    }),
    heRpcPost<Omit<OpenOrder, 'side'>[]>(HE_RPC, 'find', {
      contract: 'market', table: 'sellBook', query: { account, symbol: sym },
      indexes: [{ index: 'priceDec', descending: false }], limit: 1000, offset: 0,
    }),
  ])

  const buyOrders: OpenOrder[] = (buyRaw ?? []).map(r => ({ ...r, side: 'buy' as const }))
  const sellOrders: OpenOrder[] = (sellRaw ?? []).map(r => ({ ...r, side: 'sell' as const }))

  const orders: OpenOrder[] = [
    ...sellOrders.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)),
    ...buyOrders.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)),
  ]

  return { orders }
}

export async function fetchAllOpenOrders(username: string): Promise<{ orders: OpenOrder[] }> {
  const account = username.toLowerCase()

  const [buyRaw, sellRaw] = await Promise.all([
    heRpcPost<Omit<OpenOrder, 'side'>[]>(HE_RPC, 'find', {
      contract: 'market', table: 'buyBook', query: { account },
      indexes: [{ index: 'priceDec', descending: true }], limit: 1000, offset: 0,
    }),
    heRpcPost<Omit<OpenOrder, 'side'>[]>(HE_RPC, 'find', {
      contract: 'market', table: 'sellBook', query: { account },
      indexes: [{ index: 'priceDec', descending: false }], limit: 1000, offset: 0,
    }),
  ])

  const buyOrders: OpenOrder[] = (buyRaw ?? []).map(r => ({ ...r, side: 'buy' as const }))
  const sellOrders: OpenOrder[] = (sellRaw ?? []).map(r => ({ ...r, side: 'sell' as const }))

  const orders: OpenOrder[] = [
    ...sellOrders.sort((a, b) => b.timestamp - a.timestamp),
    ...buyOrders.sort((a, b) => b.timestamp - a.timestamp),
  ]

  return { orders }
}
