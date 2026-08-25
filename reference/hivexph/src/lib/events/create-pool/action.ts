// ── Event: create-pool ─────────────────────────────────────────────────────
// Use-case: create a new Hive Engine market pool via a marketpools.createPool
// custom_json broadcast on the ssc-mainnet-hive sidechain. Costs 1000 BEE.

import { customJson, type KeychainResponse } from '@/lib/keychain'
import { buildCreatePool } from '@/lib/config/keychain'

export interface CreatePoolInput {
  username: string
  tokenPair: string // e.g. "SWAP.HIVE:BEE"
}

export async function execute(input: CreatePoolInput): Promise<KeychainResponse> {
  const { username, tokenPair } = input
  return customJson(
    username,
    buildCreatePool(tokenPair),
    `Create Hive Engine pool ${tokenPair}`,
    'Active',
  )
}
