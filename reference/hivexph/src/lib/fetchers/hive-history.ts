// ported from Next.js: 'use server' directive removed

// ─────────────────────────────────────────────────────────────────────────────
// lib/fetchers/hive-history.ts — server functions for Hive transaction history
//
// Owns all fetch calls related to Hive Engine account history and L1 HIVE
// transfer history. Used by lib/fetchers/transactions.ts and any RSC that
// needs raw history data.
// ─────────────────────────────────────────────────────────────────────────────

import { HIVE_CONFIG, HIVE_ENGINE_CONFIG } from '@/lib/config/api'

const HIVE_API = HIVE_CONFIG.apiUrl
const HE_HISTORY = HIVE_ENGINE_CONFIG.accountHistoryUrl

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HiveEngineTx {
  _id: string
  blockNumber: number
  transactionId: string
  timestamp: number // unix seconds
  operation: string
  account: string
  symbol?: string
  memo?: string | null
  from?: string
  to?: string
  quantity?: string
  orderType?: string
  price?: string
  quantityLocked?: string
  quantityTokens?: string
  quantityHive?: string
  orderID?: string
  [key: string]: unknown
}

export interface HiveTransferTx {
  id: number
  trx_id: string
  block: number
  timestamp: string // ISO string e.g. "2025-04-04T14:52:30"
  from: string
  to: string
  amount: string // e.g. "99.990 HIVE"
  memo: string
}

// ── Exported server functions ─────────────────────────────────────────────────

/**
 * Fetches Hive Engine token transfer history for an account.
 */
export async function fetchHiveEngineHistory(
  account: string,
  limit = 50,
  offset = 0,
): Promise<HiveEngineTx[]> {
  try {
    const url = `${HE_HISTORY}?account=${encodeURIComponent(account)}&limit=${limit}&offset=${offset}&ops=tokens_transfer`
    const res = await fetch(url, {})
    if (!res.ok) return []
    return (await res.json()) as HiveEngineTx[]
  } catch {
    return []
  }
}

/**
 * Fetches L1 HIVE transfer history for an account using
 * condenser_api.get_account_history with op_filter "4" (transfer).
 * Pass startSeq = -1 for newest entries.
 */
export async function fetchHiveTransferHistory(
  account: string,
  startSeq = -1,
  limit = 50,
): Promise<HiveTransferTx[]> {
  try {
    const res = await fetch(HIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 0, jsonrpc: '2.0',
        method: 'condenser_api.get_account_history',
        params: [account, startSeq, limit, '4', null],
      }),
    })
    const data = await res.json()
    const raw: Array<[number, {
      op: ['transfer', { to: string; from: string; memo: string; amount: string }]
      trx_id: string
      block: number
      timestamp: string
    }]> = data?.result ?? []

    return raw.reverse().map(([id, entry]) => ({
      id,
      trx_id: entry.trx_id,
      block: entry.block,
      timestamp: entry.timestamp,
      from: entry.op[1].from,
      to: entry.op[1].to,
      amount: entry.op[1].amount,
      memo: entry.op[1].memo,
    }))
  } catch {
    return []
  }
}
