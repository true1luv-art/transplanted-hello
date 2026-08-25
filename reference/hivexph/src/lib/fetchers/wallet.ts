// ported from Next.js: 'use server' directive removed

import axios from 'axios'
import { HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const HE_RPC = HIVE_ENGINE_CONFIG.rpcUrl
const HE_API = HIVE_ENGINE_CONFIG.apiUrl
const HE_HISTORY = HIVE_ENGINE_CONFIG.historyUrl
const COINGECKO = HIVE_ENGINE_CONFIG.coingeckoUrl
const PAGE = 1000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WalletRow {
  symbol: string
  name: string
  icon: string | null
  precision: number
  balance: string
  stake: string
  delegationsIn: string
  delegationsOut: string
  pendingUnstake: string
  priceHive: string
  priceUsd: string
  usdValue: string
  priceChangePercent: string
  stakingEnabled: boolean
  delegationEnabled: boolean
}

export interface WalletData {
  rows: WalletRow[]
  totalUsd: string
  hivePriceUsd: number
}

export interface HistoryRow {
  _id: string
  timestamp: string
  operation: string
  from: string
  to: string
  quantity: string
  symbol: string
  memo?: string | null
  orderType?: string
  orderID?: string
  quantityReturned?: string
}

export interface WalletHistoryData {
  rows: HistoryRow[]
  account: string
  symbol: string
  limit: number
  offset: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function heFind<T>(
  contract: string,
  table: string,
  query: Record<string, unknown>,
  limit = PAGE,
  offset = 0,
  indexes: { index: string; descending: boolean }[] = [],
  endpoint: string = HE_RPC,
  cacheHeaders = false,
): Promise<T[]> {
  const res = await axios.post<{ result: T[] }>(endpoint, {
    jsonrpc: '2.0', id: Date.now(), method: 'find',
    params: { contract, table, query, limit, offset, indexes },
  })
  void cacheHeaders
  return res.data?.result ?? []
}

async function fetchAllPages<T>(
  contract: string,
  table: string,
  query: Record<string, unknown>,
  indexes: { index: string; descending: boolean }[] = [],
  endpoint: string = HE_RPC,
): Promise<T[]> {
  const out: T[] = []
  let offset = 0
  while (true) {
    const page = await heFind<T>(contract, table, query, PAGE, offset, indexes, endpoint)
    out.push(...page)
    if (page.length < PAGE) break
    offset += PAGE
  }
  return out
}

// ── Server Functions ──────────────────────────────────────────────────────────

export async function fetchWallet(username: string): Promise<WalletData> {
  if (!username) return { rows: [], totalUsd: '0.00', hivePriceUsd: 0 }

  const [balancesRaw, tokensRaw, metricsRaw, hivePriceUsd] = await Promise.all([
    fetchAllPages<{
      symbol: string; balance: string; stake?: string
      delegationsIn?: string; delegationsOut?: string; pendingUnstake?: string
    }>('tokens', 'balances', { account: username }, [], HE_API),

    fetchAllPages<{
      symbol: string; name: string; metadata: string; issuer: string; precision: number
      maxSupply: string; circulatingSupply: string; stakingEnabled: boolean; delegationEnabled: boolean
    }>('tokens', 'tokens', {}, [{ index: '_id', descending: false }]),

    fetchAllPages<{
      symbol: string; lastPrice: string; volume: string; volumeExpiration: number
      priceChangePercent: string; lastDayPriceExpiration: number
    }>('market', 'metrics', {}, [{ index: '_id', descending: false }]),

    axios.get<{ hive: { usd: number } }>(COINGECKO).then(r => r.data?.hive?.usd ?? 0).catch(() => 0),
  ])

  const nowSecs = Math.floor(Date.now() / 1000)
  const tokenMap = new Map(tokensRaw.map(t => [t.symbol, t]))
  const metricsMap = new Map(metricsRaw.map(m => [m.symbol, m]))

  const rows: WalletRow[] = balancesRaw
    .map(b => {
      const t = tokenMap.get(b.symbol)
      const m = metricsMap.get(b.symbol)
      let icon: string | null = null
      if (t) { try { icon = JSON.parse(t.metadata)?.icon ?? null } catch { /* */ } }

      const priceHive = parseFloat(m?.lastPrice ?? '0') || 0
      const priceUsd = priceHive * hivePriceUsd
      const balance = parseFloat(b.balance) || 0
      const stake = parseFloat(b.stake ?? '0') || 0
      const delIn = parseFloat(b.delegationsIn ?? '0') || 0
      const usdValue = (balance + stake + delIn) * priceUsd
      const changeActive = m ? m.lastDayPriceExpiration > nowSecs : false

      return {
        symbol: b.symbol,
        name: t?.name ?? b.symbol,
        icon,
        precision: t?.precision ?? 3,
        balance: b.balance,
        stake: b.stake ?? '0',
        delegationsIn: b.delegationsIn ?? '0',
        delegationsOut: b.delegationsOut ?? '0',
        pendingUnstake: b.pendingUnstake ?? '0',
        priceHive: priceHive.toFixed(8),
        priceUsd: priceUsd.toFixed(8),
        usdValue: usdValue.toFixed(4),
        priceChangePercent: changeActive ? (m?.priceChangePercent ?? '0%') : '0%',
        stakingEnabled: t?.stakingEnabled ?? false,
        delegationEnabled: t?.delegationEnabled ?? false,
      }
    })
    .sort((a, b) => {
      const diff = parseFloat(b.usdValue) - parseFloat(a.usdValue)
      if (diff !== 0) return diff
      return parseFloat(b.balance) - parseFloat(a.balance)
    })

  const totalUsd = rows.reduce((s, r) => s + parseFloat(r.usdValue), 0)
  return { rows, totalUsd: totalUsd.toFixed(2), hivePriceUsd }
}

export async function fetchWalletHistory(
  username: string,
  symbol: string,
  limit = 30,
  offset = 0,
): Promise<WalletHistoryData> {
  const safeLimit = Math.min(Math.max(1, limit), 1000)
  const safeOffset = Math.max(0, offset)
  const url = `${HE_HISTORY}/accountHistory?account=${encodeURIComponent(username)}&symbol=${encodeURIComponent(symbol)}&limit=${safeLimit}&offset=${safeOffset}`

  const res = await axios.get<Array<{
    _id: string; account: string; symbol: string; operation: string; from: string
    to: string; quantity: string; timestamp: number; blockNumber: number
    transactionId: string; memo?: string | null; orderType?: string
    orderID?: string; quantityReturned?: string
  }>>(url)

  const rows: HistoryRow[] = res.data.map(h => ({
    _id: h._id,
    timestamp: new Date(h.timestamp * 1000).toISOString(),
    operation: h.operation,
    from: h.from,
    to: h.to,
    quantity: h.quantity,
    symbol: h.symbol,
    memo: h.memo,
    orderType: h.orderType,
    orderID: h.orderID,
    quantityReturned: h.quantityReturned,
  }))

  return { rows, account: username, symbol, limit: safeLimit, offset: safeOffset }
}
