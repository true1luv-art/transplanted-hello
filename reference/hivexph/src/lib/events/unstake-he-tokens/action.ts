import { customJson } from '@/lib/keychain'
import type { KeychainResponse } from '@/lib/keychain'
import { buildUnstake } from '@/lib/config/keychain'

interface Params {
  username: string
  symbol: string
  quantity: string
}

/**
 * Unstake Hive Engine tokens.
 * Payload has NO "to" field — unstake always goes back to the caller.
 */
export async function execute({ username, symbol, quantity }: Params): Promise<KeychainResponse> {
  return customJson(username, [buildUnstake(symbol, quantity)], `Unstake (${symbol})`, 'Active')
}
