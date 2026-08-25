// ported from Next.js: 'use server' directive removed

import axios from 'axios'
import { HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const HE_API = HIVE_ENGINE_CONFIG.apiUrl
const HE_PAGE_LIMIT = 1000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwapToken {
  symbol: string
  name: string
  icon: string | null
  precision: number
  circulatingSupply: string
}

export interface TokenBalance {
  symbol: string
  balance: string
  stake: string
}

export interface SwapQuote {
  tokenIn: string
  tokenOut: string
  amountIn: number
  amountOut: number
  priceImpact: number
  fee: number
  feePercent: number
  path: string[]
  poolId: string
  poolId2: string
  poolFound: boolean
  reserveIn: number
  reserveOut: number
  spotPrice: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface HEPool {
  tokenPair: string
  baseQuantity: string
  quoteQuantity: string
  basePrice: string
  quotePrice: string
  totalShares: string
  precision: number
}

interface HEToken {
  symbol: string
  name: string
  metadata: string
  precision: number
  circulatingSupply: string
}

interface HEParams {
  tradeFeeMul: string
}

async function hePost<T>(method: string, params: Record<string, unknown>): Promise<T | null> {
  const res = await axios.post<{ result: T }>(HE_API, { jsonrpc: '2.0', id: 1, method, params })
  return res.data?.result ?? null
}

async function fetchAllPages<T>(contract: string, table: string, query: Record<string, unknown> = {}): Promise<T[]> {
  const results: T[] = []
  let offset = 0
  while (true) {
    const page = await hePost<T[]>('find', { contract, table, query, limit: HE_PAGE_LIMIT, offset, indexes: [] })
    if (!Array.isArray(page) || page.length === 0) break
    results.push(...page)
    if (page.length < HE_PAGE_LIMIT) break
    offset += HE_PAGE_LIMIT
  }
  return results
}

function getAmountOut(amountIn: number, reserveIn: number, reserveOut: number, feeMul: number): number {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) return 0
  const amountInWithFee = amountIn * feeMul
  return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
}

function getPriceImpact(amountIn: number, reserveIn: number, reserveOut: number, feeMul: number): number {
  if (reserveIn <= 0 || reserveOut <= 0 || amountIn <= 0) return 0
  const spotPrice = reserveOut / reserveIn
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, feeMul)
  if (amountOut === 0) return 0
  return Math.max(0, ((spotPrice - amountOut / amountIn) / spotPrice) * 100)
}

function resolveReserves(pool: HEPool, tokenIn: string): { reserveIn: number; reserveOut: number } {
  const [base] = pool.tokenPair.split(':')
  if (tokenIn === base) return { reserveIn: parseFloat(pool.baseQuantity), reserveOut: parseFloat(pool.quoteQuantity) }
  return { reserveIn: parseFloat(pool.quoteQuantity), reserveOut: parseFloat(pool.baseQuantity) }
}

async function findPool(tokenA: string, tokenB: string): Promise<HEPool | null> {
  const pools = await hePost<HEPool[]>('find', {
    contract: 'marketpools', table: 'pools',
    query: { tokenPair: { $in: [`${tokenA}:${tokenB}`, `${tokenB}:${tokenA}`] } },
    limit: 2, offset: 0, indexes: [],
  })
  return pools?.[0] ?? null
}

async function getTradeFee(): Promise<number> {
  const params = await hePost<HEParams>('findOne', { contract: 'marketpools', table: 'params', query: {} })
  return params?.tradeFeeMul ? parseFloat(params.tradeFeeMul) : 0.9975
}

// ── Server Functions ──────────────────────────────────────────────────────────

export async function fetchSwapTokens(): Promise<SwapToken[]> {
  const allPools = await hePost<HEPool[]>('find', {
    contract: 'marketpools', table: 'pools', query: {},
    limit: HE_PAGE_LIMIT, offset: 0, indexes: [{ index: 'baseVolume', descending: true }],
  })
  if (!Array.isArray(allPools) || allPools.length === 0) return []

  const symbolSet = new Set<string>()
  for (const pool of allPools) {
    const [base, quote] = pool.tokenPair.split(':')
    if (base) symbolSet.add(base)
    if (quote) symbolSet.add(quote)
  }
  const allSymbols = [...symbolSet]

  const tokenMap = new Map<string, HEToken>()
  const BATCH = 100
  for (let i = 0; i < allSymbols.length; i += BATCH) {
    const batch = allSymbols.slice(i, i + BATCH)
    const tokenInfos = await hePost<HEToken[]>('find', {
      contract: 'tokens', table: 'tokens', query: { symbol: { $in: batch } }, limit: BATCH,
    })
    if (Array.isArray(tokenInfos)) for (const t of tokenInfos) tokenMap.set(t.symbol, t)
  }

  const result: SwapToken[] = allSymbols.map(symbol => {
    const info = tokenMap.get(symbol)
    let icon: string | null = null
    if (info?.metadata) { try { icon = (JSON.parse(info.metadata) as { icon?: string })?.icon ?? null } catch { /* */ } }
    return { symbol, name: info?.name ?? symbol, icon, precision: info?.precision ?? 8, circulatingSupply: info?.circulatingSupply ?? '0' }
  })

  result.sort((a, b) => {
    if (a.symbol === 'SWAP.HIVE') return -1
    if (b.symbol === 'SWAP.HIVE') return 1
    if (a.symbol === 'BEE') return -1
    if (b.symbol === 'BEE') return 1
    return a.symbol.localeCompare(b.symbol)
  })

  return result
}

export async function fetchSwapBalances(account: string): Promise<TokenBalance[]> {
  if (!account) return []
  const balances = await fetchAllPages<{ symbol: string; balance: string; stake?: string }>('tokens', 'balances', { account })
  return balances.map(b => ({ symbol: b.symbol, balance: b.balance ?? '0', stake: b.stake ?? '0' }))
}

export async function fetchSwapQuote(tokenIn: string, tokenOut: string, amountIn: number): Promise<SwapQuote> {
  const noPool: SwapQuote = {
    tokenIn, tokenOut, amountIn, amountOut: 0, priceImpact: 0, fee: 0, feePercent: 0,
    path: [tokenIn, tokenOut], poolId: '', poolId2: '', poolFound: false,
    reserveIn: 0, reserveOut: 0, spotPrice: 0,
  }

  if (!tokenIn || !tokenOut || amountIn <= 0) return noPool

  const [feeMul, directPool] = await Promise.all([getTradeFee(), findPool(tokenIn, tokenOut)])
  const feePercent = parseFloat(((1 - feeMul) * 100).toFixed(4))

  if (directPool) {
    const { reserveIn, reserveOut } = resolveReserves(directPool, tokenIn)
    const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, feeMul)
    return {
      tokenIn, tokenOut, amountIn, amountOut,
      priceImpact: getPriceImpact(amountIn, reserveIn, reserveOut, feeMul),
      fee: amountIn * (1 - feeMul), feePercent,
      path: [tokenIn, tokenOut], poolId: directPool.tokenPair, poolId2: '',
      poolFound: true, reserveIn, reserveOut, spotPrice: reserveOut / reserveIn,
    }
  }

  // 2-hop via SWAP.HIVE
  const bridge = 'SWAP.HIVE'
  if (tokenIn !== bridge && tokenOut !== bridge) {
    const [poolA, poolB] = await Promise.all([findPool(tokenIn, bridge), findPool(bridge, tokenOut)])
    if (poolA && poolB) {
      const { reserveIn: rIn1, reserveOut: rOut1 } = resolveReserves(poolA, tokenIn)
      const midAmount = getAmountOut(amountIn, rIn1, rOut1, feeMul)
      const { reserveIn: rIn2, reserveOut: rOut2 } = resolveReserves(poolB, bridge)
      const amountOut = getAmountOut(midAmount, rIn2, rOut2, feeMul)
      return {
        tokenIn, tokenOut, amountIn, amountOut,
        priceImpact: getPriceImpact(amountIn, rIn1, rOut1, feeMul) + getPriceImpact(midAmount, rIn2, rOut2, feeMul),
        fee: amountIn * (1 - feeMul) + midAmount * (1 - feeMul), feePercent,
        path: [tokenIn, bridge, tokenOut], poolId: poolA.tokenPair, poolId2: poolB.tokenPair,
        poolFound: true, reserveIn: rIn1, reserveOut: rOut2, spotPrice: amountOut / amountIn,
      }
    }
  }

  return noPool
}
