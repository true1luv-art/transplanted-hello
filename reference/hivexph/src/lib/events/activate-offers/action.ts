// ── Event: activate-offers ───────────────────────────────────────────────────
// Use-case: send exactly 1.000 HIVE to the dvpm account with the activation
// window encoded in the memo. Activation is later verified from transfer
// history — no metadata broadcast is needed.
//
// Memo is a plain JSON string:
//   {"type":"offers_activated","time_started":<epoch>,"time_ended":<epoch>}

import { transfer, type KeychainResponse } from '@/lib/keychain'
import { APP_HIVE_ACCOUNT } from '@/lib/fetchers/hive-account-helpers'
import { ACTIVATION_CONFIG } from '@/lib/config/config'

export interface ActivateOffersInput {
  username: string
}

export async function execute(input: ActivateOffersInput): Promise<KeychainResponse> {
  const { username } = input

  // Build the activation window in Unix epoch seconds
  const nowSec = Math.floor(Date.now() / 1000)
  const endSec = nowSec + ACTIVATION_CONFIG.windowHours * 60 * 60
  const activation = {
    type: 'offers_activated',
    time_started: nowSec,
    time_ended: endSec,
  }

  return transfer(
    username,
    APP_HIVE_ACCOUNT,
    ACTIVATION_CONFIG.activationAmount,
    JSON.stringify(activation),
    ACTIVATION_CONFIG.activationCurrency,
  )
}
