// ── Event: swap-tokens ────────────────────────────────────────────────────────
// Use-case: perform a Hive Engine AMM swap via a marketpools.swapTokens
// custom_json broadcast on the ssc-mainnet-hive sidechain.

import { customJson, type KeychainResponse } from '@/lib/keychain'
import { buildSwap } from '@/lib/config/keychain'

export interface SwapTokensInput {
  username: string
  tokenPair: string
  tokenSymbol: string
  tokenAmount: string
  minAmountOut: string
}

export async function execute(input: SwapTokensInput): Promise<KeychainResponse> {
  const { username, tokenPair, tokenSymbol, tokenAmount, minAmountOut } = input

  return customJson(
    username,
    buildSwap(tokenPair, tokenSymbol, tokenAmount, minAmountOut),
    `Swap ${tokenAmount} ${tokenSymbol} on Hive Engine`,
    'Active',
  )
}
