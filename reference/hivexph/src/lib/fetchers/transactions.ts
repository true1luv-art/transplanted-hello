// ported from Next.js: 'use server' directive removed

import { fetchHiveEngineHistory, fetchHiveTransferHistory } from '@/lib/fetchers/hive-history'
import type { HiveEngineTx, HiveTransferTx } from '@/lib/fetchers/hive-history'
import { getSession } from '@/lib/session'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Layer = 'l1' | 'l2'

export interface TransactionsResult {
  txns: (HiveEngineTx | HiveTransferTx)[]
  layer: Layer
  limit: number
  offset?: number
}

export interface CombinedTx {
  _id: string
  timestamp: string
  layer: Layer
  operation: string
  from: string
  to: string
  amount: string
  symbol: string
  memo?: string | null
  incoming: boolean
}

export interface RecentTransactionsResult {
  txns: CombinedTx[]
}

// ── Server Functions ──────────────────────────────────────────────────────────

export async function fetchTransactions(
  layer: Layer = 'l2',
  limit = 50,
  offset = 0,
  startSeq = -1,
  usernameArg?: string,
): Promise<TransactionsResult> {
  let username = usernameArg
  if (!username) {
    const session = await getSession()
    username = session?.username
  }
  if (!username) throw new Error('Unauthorized')

  const safeLimit = Math.min(limit, 100)

  if (layer === 'l1') {
    const txns = await fetchHiveTransferHistory(username, startSeq, safeLimit)
    return { txns, layer: 'l1', limit: safeLimit }
  }

  const safeOffset = Math.max(0, offset)
  const txns = await fetchHiveEngineHistory(username, safeLimit, safeOffset)
  return { txns, layer: 'l2', limit: safeLimit, offset: safeOffset }
}

export async function fetchRecentTransactions(
  usernameArg?: string,
): Promise<RecentTransactionsResult> {
  let username = usernameArg
  if (!username) {
    const session = await getSession()
    username = session?.username
  }
  if (!username) throw new Error('Unauthorized')


  const [l2Txns, l1Txns] = await Promise.all([
    fetchHiveEngineHistory(username, 50, 0),
    fetchHiveTransferHistory(username, -1, 50),
  ])

  const combined: CombinedTx[] = []

  l2Txns.forEach((tx: HiveEngineTx) => {
    combined.push({
      _id: tx._id,
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
      layer: 'l2',
      operation: tx.operation,
      from: tx.from ?? '',
      to: tx.to ?? '',
      amount: tx.quantity || '0',
      symbol: tx.symbol ?? '',
      memo: tx.memo,
      incoming: tx.to === username,
    })
  })

  l1Txns.forEach((tx: HiveTransferTx) => {
    const [amountStr, symbol] = tx.amount.split(' ')
    combined.push({
      _id: `${tx.id}-${tx.trx_id}`,
      timestamp: tx.timestamp,
      layer: 'l1',
      operation: 'Transfer',
      from: tx.from,
      to: tx.to,
      amount: amountStr,
      symbol,
      memo: tx.memo,
      incoming: tx.to === username,
    })
  })

  const txns = combined
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)

  return { txns }
}
