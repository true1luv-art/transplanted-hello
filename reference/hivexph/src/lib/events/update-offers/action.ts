// ── Event: update-offers ─────────────────────────────────────────────────────
// Use-case: write offers { buy: OfferEntry[], sell: OfferEntry[] } to the user's
// posting_json_metadata via account_update2. Each offer entry is stamped with
// the account's current payment_methods snapshot.

import { broadcast, type KeychainResponse } from '@/lib/keychain'
import { buildAccountUpdate2 } from '@/lib/config/keychain'
import { fetchPostingJsonMeta } from '@/lib/fetchers/hive-account-helpers'
import type { OffersValues } from '@/lib/context/schemas'

export interface UpdateOffersInput {
  username: string
  offers: OffersValues
}

export async function execute(input: UpdateOffersInput): Promise<KeychainResponse> {
  const { username, offers } = input
  const existingMeta = await fetchPostingJsonMeta(username)

  // Snapshot payment_methods from metadata to embed in every offer entry
  const pm = (existingMeta.payment_methods ?? []) as string[]

  function withPM(entries: OffersValues['buy']) {
    return entries.map((e) => ({ ...e, payment_methods: pm }))
  }

  const newMeta: Record<string, unknown> = {
    ...existingMeta,
    offers: {
      buy: withPM(offers.buy),
      sell: withPM(offers.sell),
    },
  }

  return broadcast(username, buildAccountUpdate2(username, JSON.stringify(newMeta)), 'Posting')
}
