// ── Event: update-payment-methods ────────────────────────────────────────────
// Use-case: write payment_methods: [] to the user's posting_json_metadata via
// account_update2. Values are de-duplicated and blanks removed.

import { broadcast, type KeychainResponse } from '@/lib/keychain'
import { buildAccountUpdate2 } from '@/lib/config/keychain'
import { fetchPostingJsonMeta } from '@/lib/fetchers/hive-account-helpers'
import type { PaymentMethodsValues } from '@/lib/context/schemas'

export interface UpdatePaymentMethodsInput {
  username: string
  methods: PaymentMethodsValues
}

export async function execute(input: UpdatePaymentMethodsInput): Promise<KeychainResponse> {
  const { username, methods } = input
  const existingMeta = await fetchPostingJsonMeta(username)

  // Deduplicate and remove blanks
  const clean = [...new Set(methods.map((m) => m.trim()).filter(Boolean))]

  const newMeta: Record<string, unknown> = {
    ...existingMeta,
    payment_methods: clean,
  }

  return broadcast(username, buildAccountUpdate2(username, JSON.stringify(newMeta)), 'Posting')
}
