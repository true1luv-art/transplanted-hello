// ported from Next.js: 'use server' directive removed

// ─────────────────────────────────────────────────────────────────────────────
// lib/fetchers/p2p.ts — server functions for P2P offer and review data
//
// Owns all Hive API calls related to P2P: offer activation windows,
// live offer listings, merchant reviews, and single-offer lookup.
// Called by /api/p2p/* route handlers and RSC pages.
// ─────────────────────────────────────────────────────────────────────────────

import { HIVE_CONFIG, HIVE_ENGINE_CONFIG as _HE } from '@/lib/config/api'
import { ACTIVATION_CONFIG } from '@/lib/config/config'
import { fetchPostingJsonMeta, APP_HIVE_ACCOUNT } from '@/lib/fetchers/hive-account-helpers'

const HIVE_API = HIVE_CONFIG.apiUrl

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OffersActivated {
  time_started: number
  time_ended: number
}

export interface LiveOffer {
  id: string
  side: 'buy' | 'sell'
  merchant: string
  price: number
  currency: string
  token: string
  minLimit: number
  maxLimit: number
  paymentMethods: string[]
  activation: OffersActivated
}

export interface ReviewData {
  version: number
  rating: number
  feedback: string
}

export interface MerchantReview {
  author: string
  permlink: string
  body: string
  created: string
  author_reputation: number
  active_votes: Array<{ voter: string; rshares: number }>
  reviewData: ReviewData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseReviewData(body: string): ReviewData | null {
  try {
    const parsed = JSON.parse(body.trim()) as Record<string, unknown>
    const r = parsed.merchant_review as Record<string, unknown> | undefined
    if (
      r &&
      r.version === 1 &&
      typeof r.rating === 'number' &&
      r.rating >= 1 &&
      r.rating <= 5 &&
      typeof r.feedback === 'string' &&
      r.feedback.trim().length > 0
    ) {
      return { version: 1, rating: r.rating, feedback: r.feedback.trim() }
    }
  } catch { /* not valid JSON */ }
  return null
}

// ── Exported server functions ─────────────────────────────────────────────────

/**
 * Checks whether a user's offers are currently active by scanning their
 * outgoing transfer history for a qualifying activation memo.
 */
export async function getOffersActivation(
  username: string,
): Promise<OffersActivated | null> {
  try {
    const nowSec = Math.floor(Date.now() / 1000)
    const res = await fetch(HIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 0,
        jsonrpc: '2.0',
        method: 'condenser_api.get_account_history',
        params: [username, -1, ACTIVATION_CONFIG.historyLimit, '4', null],
      }),
    })
    const data = await res.json()
    const history: Array<[number, {
      op: [string, { to: string; from: string; amount: string; memo: string }]
    }]> = data?.result ?? []

    for (const [, entry] of history.reverse()) {
      const [opType, op] = entry.op
      if (
        opType !== 'transfer' ||
        op.to !== APP_HIVE_ACCOUNT ||
        op.amount !== ACTIVATION_CONFIG.activationLabel
      ) continue
      try {
        const parsed = JSON.parse(op.memo) as Record<string, unknown>
        if (
          parsed.type === 'offers_activated' &&
          typeof parsed.time_started === 'number' &&
          typeof parsed.time_ended === 'number' &&
          nowSec >= parsed.time_started &&
          nowSec <= parsed.time_ended
        ) {
          return { time_started: parsed.time_started, time_ended: parsed.time_ended }
        }
      } catch { continue }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Queries the app account history for recent activation transfers,
 * then cross-checks each sender's metadata for active offers.
 */
export async function fetchLiveOffers(historyLimit = 100): Promise<LiveOffer[]> {
  try {
    const res = await fetch(HIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 0,
        jsonrpc: '2.0',
        method: 'condenser_api.get_account_history',
        params: [APP_HIVE_ACCOUNT, -1, historyLimit, '4', null],
      }),
    })
    const data = await res.json()
    const history: Array<[number, {
      op: [string, { to: string; from: string; amount: string; memo: string }]
      timestamp: string
    }]> = data?.result ?? []

    const senderSet = new Set<string>()
    for (const [, entry] of history) {
      const [opType, op] = entry.op
      if (
        opType === 'transfer' &&
        op.to === APP_HIVE_ACCOUNT &&
        op.amount === ACTIVATION_CONFIG.activationLabel
      ) senderSet.add(op.from)
    }
    if (senderSet.size === 0) return []

    const results = await Promise.all(
      [...senderSet].map(async (username): Promise<LiveOffer[]> => {
        const activation = await getOffersActivation(username)
        if (!activation) return []

        const meta = await fetchPostingJsonMeta(username)
        const offersData = meta.offers as { buy?: unknown[]; sell?: unknown[] } | undefined
        if (!offersData) return []

        const topLevelPM = (meta.payment_methods ?? []) as string[]
        const live: LiveOffer[] = []
        const sides: { side: 'buy' | 'sell'; entries: unknown[] }[] = [
          { side: 'buy',  entries: Array.isArray(offersData.buy)  ? offersData.buy  : [] },
          { side: 'sell', entries: Array.isArray(offersData.sell) ? offersData.sell : [] },
        ]
        for (const { side, entries } of sides) {
          entries.forEach((raw, idx) => {
            const entry = raw as Record<string, unknown>
            if (!entry.price || !entry.token) return
            const limit = entry.limit as { min?: number; max?: number } | undefined
            const pm: string[] = Array.isArray(entry.payment_methods)
              ? (entry.payment_methods as string[])
              : topLevelPM
            live.push({
              id: `${username}-${side}-${idx}`,
              side, merchant: username,
              price: Number(entry.price), currency: 'PHP',
              token: String(entry.token),
              minLimit: Number(limit?.min ?? 0), maxLimit: Number(limit?.max ?? 0),
              paymentMethods: pm, activation,
            })
          })
        }
        return live
      }),
    )
    return results.flat()
  } catch {
    return []
  }
}

/**
 * Fetches merchant reviews from their application post using bridge.get_discussion.
 */
export async function fetchMerchantReviews(
  author: string,
  permlink = 'merchant-application',
): Promise<MerchantReview[]> {
  try {
    const res = await fetch(HIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 11, jsonrpc: '2.0', method: 'bridge.get_discussion',
        params: { author, permlink },
      }),
    })
    const data = await res.json()
    const discussion = (data?.result ?? {}) as Record<string, {
      author: string; permlink: string; body: string; created: string
      depth: number; parent_author: string; parent_permlink: string
      author_reputation: number
      active_votes: Array<{ voter: string; rshares: number }>
      stats?: { gray?: boolean; hide?: boolean }
    }>

    const reviews: MerchantReview[] = []
    for (const entry of Object.values(discussion)) {
      if (
        entry.depth !== 1 ||
        entry.parent_author !== author ||
        entry.parent_permlink !== permlink ||
        entry.stats?.gray || entry.stats?.hide
      ) continue
      const reviewData = parseReviewData(entry.body)
      if (!reviewData) continue
      reviews.push({
        author: entry.author, permlink: entry.permlink,
        body: entry.body, created: entry.created,
        author_reputation: entry.author_reputation ?? 0,
        active_votes: entry.active_votes ?? [],
        reviewData,
      })
    }
    reviews.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    return reviews
  } catch {
    return []
  }
}

/**
 * Fetches a single offer from a merchant's on-chain metadata by offer ID.
 * ID format: "{merchant}-{buy|sell}-{index}"
 */
export async function getOfferById(offerId: string): Promise<LiveOffer | null> {
  const match = offerId.match(/^(.+)-(buy|sell)-(\d+)$/)
  if (!match) return null
  const [, merchant, sideStr, rawIdx] = match
  const side = sideStr as 'buy' | 'sell'
  const index = parseInt(rawIdx, 10)

  try {
    const meta = await fetchPostingJsonMeta(merchant)
    const offersData = meta.offers as { buy?: unknown[]; sell?: unknown[] } | undefined
    const entries = Array.isArray(offersData?.[side]) ? offersData![side]! : []
    const raw = entries[index] as Record<string, unknown> | undefined
    if (!raw || !raw.price || !raw.token) return null

    const limit = raw.limit as { min?: number; max?: number } | undefined
    const topLevelPM = (meta.payment_methods ?? []) as string[]
    const pm: string[] = Array.isArray(raw.payment_methods)
      ? (raw.payment_methods as string[])
      : topLevelPM

    const oa = (await getOffersActivation(merchant)) ?? { time_started: 0, time_ended: 0 }
    return {
      id: offerId, side, merchant,
      price: Number(raw.price), currency: 'PHP',
      token: String(raw.token),
      minLimit: Number(limit?.min ?? 0), maxLimit: Number(limit?.max ?? 0),
      paymentMethods: pm, activation: oa,
    }
  } catch {
    return null
  }
}
