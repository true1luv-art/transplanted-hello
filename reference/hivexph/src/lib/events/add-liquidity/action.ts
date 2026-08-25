import { customJson, type KeychainResponse } from '@/lib/keychain'
import { buildAddLiquidity } from '@/lib/config/keychain'

export interface AddLiquidityInput {
  username: string
  tokenPair: string
  baseQuantity: string
  quoteQuantity: string
  maxPriceImpact: string
  maxDeviation?: string
}

export async function execute(input: AddLiquidityInput): Promise<KeychainResponse> {
  const { username, tokenPair, baseQuantity, quoteQuantity, maxPriceImpact, maxDeviation = '0' } = input
  return customJson(
    username,
    buildAddLiquidity(tokenPair, baseQuantity, quoteQuantity, maxPriceImpact, maxDeviation),
    `Add Liquidity (${tokenPair})`,
    'Active',
  )
}
