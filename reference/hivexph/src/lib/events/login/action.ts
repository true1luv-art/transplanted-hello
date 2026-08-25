// ── Event: login ──────────────────────────────────────────────────────────────
// Use-case: authenticate a user by asking Keychain to sign a buffer with their
// Posting key. No outbound Hive RPC and no broadcast — purely a signature.

import { signBuffer, normalizeUsername, type KeychainResponse } from '@/lib/keychain'

export interface LoginInput {
  username: string
}

export async function execute(input: LoginInput): Promise<KeychainResponse> {
  const username = normalizeUsername(input.username)
  if (!username) throw new Error('A username is required to log in.')

  const message = JSON.stringify({ app: 'hivep2p', ts: Date.now() })
  return signBuffer(username, message, 'Posting')
}
