import { customJson, type KeychainResponse } from '@/lib/keychain'
import { buildRemoveLiquidity } from '@/lib/config/keychain'

export interface RemoveLiquidityInput {
  username: string
  tokenPair: string
  sharesOut: string
}

export async function execute(input: RemoveLiquidityInput): Promise<KeychainResponse> {
  const { username, tokenPair, sharesOut } = input
  return customJson(
    username,
    buildRemoveLiquidity(tokenPair, sharesOut),
    `Remove Liquidity (${tokenPair})`,
    'Active',
  )
}
