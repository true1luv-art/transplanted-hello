
// ─────────────────────────────────────────────────────────────────────────────
// useAxios — centralized data-access hook
//
// Architecture:
//   • lib/fetchers/*.ts — "use server" functions that own all external RPC
//     calls (Hive Engine, CoinGecko, etc.). They are re-exported here so
//     client components import from a single place, mirroring useHiveKeychain.
//
//   • useApi<T>(fetcher, config?) — SWR wrapper. Pass a Server Function
//     (or any async fn) as the fetcher. The SWR key is derived automatically.
//
//   • api.p2p*() — URL builders for the P2P routes, which remain as public
//     /api/* Route Handlers. Use useApi(api.p2pOffers()) for those.
//
//   • axiosGet / axiosPost — low-level helpers available for direct use
//     inside callbacks that cannot use SWR.
//
// Mutations (stake, unstake, transfer, place order, etc.) go through
// Hive Keychain in the browser — they never touch any route or fetcher.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo } from 'react'
import useSWR, { type SWRConfiguration, type SWRResponse } from 'swr'
import axios, { type AxiosRequestConfig } from 'axios'

// ── Re-export all server fetchers ─────────────────────────────────────────────
// Client components import from here only — same pattern as useHiveKeychain.ts

export { fetchTokens }                                           from '@/lib/fetchers/tokens'
export type { TokenRow }                                         from '@/lib/fetchers/tokens'

export { fetchSwapTokens, fetchSwapBalances, fetchSwapQuote }    from '@/lib/fetchers/swap'
export type { SwapToken, TokenBalance, SwapQuote }               from '@/lib/fetchers/swap'

export { fetchTradeTokens, fetchTradeMarket, fetchOpenOrders, fetchAllOpenOrders }   from '@/lib/fetchers/trade'
export type { TokenListItem, MarketData, OpenOrder }             from '@/lib/fetchers/trade'

export { fetchWallet, fetchWalletHistory }                       from '@/lib/fetchers/wallet'
export type { WalletData, WalletRow, WalletHistoryData, HistoryRow } from '@/lib/fetchers/wallet'

export { fetchTransactions, fetchRecentTransactions }            from '@/lib/fetchers/transactions'
export type { TransactionsResult, RecentTransactionsResult, CombinedTx, Layer } from '@/lib/fetchers/transactions'

export { fetchPools }                                            from '@/lib/fetchers/pools'
export type { Pool }                                             from '@/lib/fetchers/pools'

export { fetchTokenSparklines }                                  from '@/lib/fetchers/sparkline'
export type { SparklineMap }                                     from '@/lib/fetchers/sparkline'

// ── Axios instances ───────────────────────────────────────────────────────────

/** GET /api/p2p/* and any remaining internal routes */
const internalClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
})

/** External POST RPCs — kept for backwards compatibility with legacy callers */
const externalClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
})

// ── Low-level helpers ─────────────────────────────────────────────────────────

export async function axiosGet<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await internalClient.get<T>(url, config)
  return res.data
}

export async function axiosPost<T = unknown>(url: string, body: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await externalClient.post<T>(url, body, config)
  return res.data
}

/** @deprecated Use axiosPost for external RPC calls */
export async function jsonFetcher<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  if (init?.method === 'POST' || (init?.body !== undefined && init?.method !== 'GET')) {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    return axiosPost<T>(url, body)
  }
  return axiosGet<T>(url)
}

// ── P2P endpoint builders (public /api/* routes — these stay) ─────────────────

export const api = {
  p2pOffers: () => '/api/public/p2p/offers',
  p2pOffer: (offerId: string) => `/api/public/p2p/offers/${encodeURIComponent(offerId)}`,
  p2pActivation: (username: string) => `/api/public/p2p/activation/${encodeURIComponent(username)}`,
  p2pReviews: (username: string) => `/api/public/p2p/reviews/${encodeURIComponent(username)}`,
} as const

// ── useApi — SWR wrapper ──────────────────────────────────────────────────────
//
// Two call signatures:
//
//   1. Server Function fetcher (new pattern):
//      const { data } = useApi(() => fetchWallet(username), { refreshInterval: 60_000 })
//
//   2. P2P route string (existing pattern — still works):
//      const { data } = useApi(api.p2pOffers())
//
// The SWR key for (1) is the fetcher function's .toString() which is stable
// per closure. Pass an explicit key as the first element of a tuple to
// override if needed: useApi(['wallet', username], () => fetchWallet(username))

type FetcherFn<T> = () => Promise<T>

// Overload: string key → axiosGet (p2p routes)
export function useApi<T = unknown>(key: string | null, config?: SWRConfiguration<T>): SWRResponse<T>
// Overload: fetcher function (server functions)
export function useApi<T = unknown>(fetcher: FetcherFn<T> | null, config?: SWRConfiguration<T>): SWRResponse<T>
// Overload: [key, fetcher] tuple for explicit cache key control
export function useApi<T = unknown>(keyAndFetcher: [string, FetcherFn<T>] | null, config?: SWRConfiguration<T>): SWRResponse<T>

export function useApi<T = unknown>(
  input: string | null | FetcherFn<T> | null | [string, FetcherFn<T>] | null,
  config?: SWRConfiguration<T>,
): SWRResponse<T> {
  if (input === null || input === undefined) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSWR<T>(null, null, { revalidateOnFocus: false, ...config })
  }

  if (typeof input === 'string') {
    // P2P /api/* route — use axiosGet
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSWR<T>(input, (url: string) => axiosGet<T>(url), { revalidateOnFocus: false, ...config })
  }

  if (Array.isArray(input)) {
    const [key, fetcher] = input
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSWR<T>(key, fetcher, { revalidateOnFocus: false, ...config })
  }

  // Server function — use its toString() as the SWR cache key
  const fn = input as FetcherFn<T>
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSWR<T>(fn.toString(), fn, { revalidateOnFocus: false, ...config })
}

// ── useAxios — imperative GET for one-off reads outside SWR ──────────────────

export function useAxios() {
  const get = useCallback(<T = unknown>(url: string, config?: AxiosRequestConfig) => axiosGet<T>(url, config), [])
  return useMemo(() => ({ get, api }), [get])
}
