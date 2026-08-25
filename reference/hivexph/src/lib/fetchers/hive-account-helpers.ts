/**
 * lib/fetchers/hive-account-helpers.ts
 *
 * All Hive account helpers: types, URL builders, parsers, and async fetchers.
 * No 'use server' directive — safe to import from Client Components,
 * Server Components, event actions, and API routes.
 */

import axios from 'axios'
import { HIVE_CONFIG } from '@/lib/config/api'
import { ACTIVATION_CONFIG } from '@/lib/config/config'

// ── App account constant ──────────────────────────────────────────────────────

export const APP_HIVE_ACCOUNT = ACTIVATION_CONFIG.watchAccount

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HiveProfile {
  profile_image?: string
  cover_image?: string
  name?: string
  about?: string
  version?: number
}

export interface HiveAccount {
  id: number
  name: string
  post_count: number
  reputation: number
  posting_json_metadata: string
  created: string
  balance: string
  hbd_balance: string
}

export interface HiveContacts {
  facebook?: string
  telegram?: string
  discord?: string
  merchant_account?: string
}

// ── URL helpers ───────────────────────────────────────────────────────────────

export function hiveAvatarUrl(username: string): string {
  return `${HIVE_CONFIG.imageProxyUrl}/u/${username}/avatar`
}

export function hiveCoverUrl(username: string): string {
  return `${HIVE_CONFIG.imageProxyUrl}/u/${username}/cover`
}

// ── Parsers ───────────────────────────────────────────────────────────────────

export function parseHiveProfile(account: HiveAccount): HiveProfile {
  try {
    const meta = JSON.parse(account.posting_json_metadata ?? '{}')
    return (meta?.profile ?? {}) as HiveProfile
  } catch {
    return {}
  }
}

/**
 * Extracts contacts from posting_json_metadata.
 * Prefers meta.contact, falls back to meta.profile for legacy accounts.
 */
export function parseHiveContacts(account: HiveAccount): HiveContacts {
  try {
    const meta    = JSON.parse(account.posting_json_metadata ?? '{}')
    const contact = (meta?.contact ?? {}) as Record<string, string>
    const profile = (meta?.profile ?? {}) as Record<string, string>
    const keys: (keyof HiveContacts)[] = ['facebook', 'telegram', 'discord', 'merchant_account']
    const result: HiveContacts = {}
    for (const key of keys) {
      const val = contact[key] ?? profile[key] ?? ''
      if (val.trim()) result[key] = val.trim()
    }
    return result
  } catch {
    return {}
  }
}

// ── Async fetchers ────────────────────────────────────────────────────────────

/**
 * Fetches a single Hive account by username.
 * Returns null if the account does not exist or the request fails.
 */
export async function getHiveAccount(
  username: string,
): Promise<HiveAccount | null> {
  try {
    const { data } = await axios.post<{ result: HiveAccount[] }>(
      HIVE_CONFIG.apiUrl,
      {
        id: 0,
        jsonrpc: '2.0',
        method: 'condenser_api.get_accounts',
        params: [[username]],
      },
    )
    return data?.result?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * Fetches and parses the raw posting_json_metadata object for an account.
 * Returns an empty object on failure.
 */
export async function fetchPostingJsonMeta(
  username: string,
): Promise<Record<string, unknown>> {
  try {
    const account = await getHiveAccount(username)
    if (!account) return {}
    return JSON.parse(account.posting_json_metadata ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Walks account history in reverse to find the most recent top-level comment
 * on parent_permlink "p2p" — the merchant application post.
 * Returns null if none found.
 */
export async function discoverMerchantPermlink(
  username: string,
): Promise<string | null> {
  try {
    const { data } = await axios.post<{
      result: Array<[number, { op: [string, Record<string, string>] }]>
    }>(HIVE_CONFIG.apiUrl, {
      id: 1,
      jsonrpc: '2.0',
      method: 'condenser_api.get_account_history',
      params: [username, -1, 1000],
    })
    const history = data?.result ?? []
    for (let i = history.length - 1; i >= 0; i--) {
      const [, { op }] = history[i]
      const [opType, opData] = op
      if (
        opType === 'comment' &&
        opData.parent_author   === '' &&
        opData.parent_permlink === 'p2p' &&
        opData.author          === username
      ) {
        return opData.permlink
      }
    }
    return null
  } catch {
    return null
  }
}
