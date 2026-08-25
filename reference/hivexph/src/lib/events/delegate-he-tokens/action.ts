import { customJson } from '@/lib/keychain'
import type { KeychainResponse } from '@/lib/keychain'
import { buildDelegate } from '@/lib/config/keychain'

interface DelegateHeTokensParams {
  username: string
  to: string
  symbol: string
  quantity: string
}

export async function execute({
  username,
  to,
  symbol,
  quantity,
}: DelegateHeTokensParams): Promise<KeychainResponse> {
  return customJson(username, [buildDelegate(to, symbol, quantity)], `Delegate (${symbol})`, 'Active')
}
