// ─────────────────────────────────────────────────────────────────────────────
// Shared Hive Keychain client primitives
//
// This is the single low-level access point to the `window.hive_keychain`
// browser extension. Event actions in `/lib/events/*` build their payloads
// using lib/config/keychain.ts and call these promisified helpers — they
// never touch `window.hive_keychain` directly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared response type ──────────────────────────────────────────────────────
export interface KeychainResponse {
  success: boolean
  message?: string
  result?: unknown
}

// ── CustomJsonPayload lives in lib/config/keychain.ts ────────────────────────
// Imported for use in the customJson() signature and re-exported so existing
// imports from '@/lib/keychain' keep working unchanged.
import { HE_CHAIN_ID } from '@/lib/config/keychain'
import type { CustomJsonPayload } from '@/lib/config/keychain'
export type { CustomJsonPayload } from '@/lib/config/keychain'

// ── Raw window.hive_keychain extension shape ─────────────────────────────────
interface HiveKeychain {
  requestTransfer: (
    username: string,
    to: string,
    amount: string,
    memo: string,
    currency: string,
    callback: (response: KeychainResponse) => void,
  ) => void
  requestCustomJson: (
    username: string,
    id: string,
    keyType: string,
    json: string,
    memo: string,
    callback: (response: KeychainResponse) => void,
  ) => void
  requestSignBuffer: (
    username: string,
    message: string,
    keyType: string,
    callback: (response: KeychainResponse) => void,
  ) => void
  requestBroadcast: (
    username: string,
    operations: unknown[],
    keyType: string,
    callback: (response: KeychainResponse) => void,
  ) => void
  requestSendToken: (
    username: string,
    to: string,
    amount: string,
    memo: string,
    currency: string,
    callback: (response: KeychainResponse) => void,
  ) => void
}

declare global {
  interface Window {
    hive_keychain?: HiveKeychain
  }
}

/**
 * Returns the injected Hive Keychain extension or throws a friendly error.
 * Throws on the server (no `window`).
 */
export function getKeychain(): HiveKeychain {
  if (typeof window === 'undefined') {
    throw new Error('Hive Keychain is not available on the server side')
  }
  if (!window.hive_keychain) {
    throw new Error(
      'Hive Keychain extension is not installed. Please install the Hive Keychain browser extension.',
    )
  }
  return window.hive_keychain
}

/** Strip a leading "@" and surrounding whitespace from a username. */
export function normalizeUsername(username: string): string {
  return username.replace(/^@/, '').trim()
}

// ── Promisified wrappers ──────────────────────────────────────────────────────

export function signBuffer(
  username: string,
  message: string,
  keyType: 'Posting' | 'Active' = 'Posting',
): Promise<KeychainResponse> {
  const keychain = getKeychain()
  return new Promise((resolve, reject) => {
    keychain.requestSignBuffer(username, message, keyType, (res) => {
      if (res?.success) resolve(res)
      else reject(new Error(res?.message ?? 'Keychain request cancelled or failed.'))
    })
  })
}

export function broadcast(
  username: string,
  operations: unknown[],
  keyType: 'Posting' | 'Active' = 'Posting',
): Promise<KeychainResponse> {
  const keychain = getKeychain()
  return new Promise((resolve, reject) => {
    keychain.requestBroadcast(username, operations, keyType, (res) => {
      if (res?.success) resolve(res)
      else reject(new Error(res?.message ?? 'Keychain broadcast cancelled or failed.'))
    })
  })
}

export function customJson(
  username: string,
  payload: CustomJsonPayload | CustomJsonPayload[],
  memo: string,
  keyType: 'Posting' | 'Active' = 'Active',
  id = HE_CHAIN_ID,
): Promise<KeychainResponse> {
  const keychain = getKeychain()
  // Hive Engine expects an array of operations — always wrap in array
  const operations = Array.isArray(payload) ? payload : [payload]
  return new Promise((resolve, reject) => {
    keychain.requestCustomJson(
      username,
      id,
      keyType,
      JSON.stringify(operations),
      memo,
      (res) => {
        if (res?.success) resolve(res)
        else reject(new Error(res?.message ?? 'Custom JSON broadcast cancelled or failed.'))
      },
    )
  })
}

export function transfer(
  username: string,
  to: string,
  amount: string,
  memo: string,
  currency = 'HIVE',
): Promise<KeychainResponse> {
  const keychain = getKeychain()
  return new Promise((resolve, reject) => {
    keychain.requestTransfer(username, to, amount, memo, currency, (res) => {
      if (res?.success) resolve(res)
      else reject(new Error(res?.message ?? 'Transfer cancelled or failed.'))
    })
  })
}

export function sendToken(
  username: string,
  to: string,
  amount: string,
  memo: string,
  currency: string,
): Promise<KeychainResponse> {
  const keychain = getKeychain()
  return new Promise((resolve, reject) => {
    keychain.requestSendToken(username, to, amount, memo, currency, (res) => {
      if (res?.success) resolve(res)
      else reject(new Error(res?.message ?? 'Token transfer cancelled or failed.'))
    })
  })
}
