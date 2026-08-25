// ── Event: transfer-tokens ────────────────────────────────────────────────────
// Use-case: send a native Hive L1 transfer (HIVE/HBD) via Keychain. Amount is
// formatted to 3 decimal places as required by the chain.

import { transfer, type KeychainResponse } from '@/lib/keychain'

export interface TransferTokensInput {
  username: string
  to: string
  amount: number
  memo: string
  currency?: string
}

export async function execute(input: TransferTokensInput): Promise<KeychainResponse> {
  const { username, to, amount, memo, currency = 'HIVE' } = input
  const formattedAmount = parseFloat(String(amount)).toFixed(3)
  return transfer(username, to, formattedAmount, memo, currency)
}
