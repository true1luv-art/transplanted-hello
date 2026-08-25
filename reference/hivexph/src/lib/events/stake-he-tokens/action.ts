import { customJson } from '@/lib/keychain'
import type { KeychainResponse } from '@/lib/keychain'
import { buildStake } from '@/lib/config/keychain'

interface Params {
  username: string
  to: string
  symbol: string
  quantity: string
}

/**
 * Stakes Hive Engine tokens via Hive Keychain custom JSON.
 * contractName: "tokens", contractAction: "stake", key type: Active
 */
export async function execute({ username, to, symbol, quantity }: Params): Promise<KeychainResponse> {
  return customJson(username, buildStake(to, symbol, quantity), `Stake (${symbol})`, 'Active')
}
