// ── Event: transfer-he-tokens ─────────────────────────────────────────────────
// Use-case: send a Hive Engine token transfer via Keychain requestCustomJson.
// Uses Active key, broadcast id ssc-mainnet-hive.

import { sendToken, type KeychainResponse } from '@/lib/keychain'

export interface TransferHeTokensInput {
  username: string
  to: string
  symbol: string
  amount: number
  precision: number
  memo?: string
}

export async function execute(input: TransferHeTokensInput): Promise<KeychainResponse> {
  const { username, to, symbol, amount, precision, memo = '' } = input
  const formattedQuantity = parseFloat(String(amount)).toFixed(precision)
  return sendToken(username, to, formattedQuantity, memo, symbol)
}
