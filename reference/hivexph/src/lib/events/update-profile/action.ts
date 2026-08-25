// ── Event: update-profile ────────────────────────────────────────────────────
// Use-case: update a merchant's Hive profile via an account_update2 broadcast.
// Existing posting_json_metadata is fetched first so unrelated fields are never
// wiped. Only keys explicitly provided in the input are changed.

import { broadcast, type KeychainResponse } from '@/lib/keychain'
import { buildAccountUpdate2 } from '@/lib/config/keychain'
import { fetchPostingJsonMeta } from '@/lib/fetchers/hive-account-helpers'

export interface HiveProfileUpdate {
  /** Goes inside profile: {} */
  name?: string
  about?: string
  location?: string
  website?: string
  /** Go inside a sibling contact: {} object */
  facebook?: string
  telegram?: string
  discord?: string
  merchant_account?: string
  /** Replaces payment_methods: [] in the same single broadcast */
  payment_methods?: string[]
}

export interface UpdateProfileInput {
  username: string
  update: HiveProfileUpdate
}

export async function execute(input: UpdateProfileInput): Promise<KeychainResponse> {
  const { username, update } = input

  // 1. Fetch existing metadata so we never wipe unrelated fields
  const existingMeta = await fetchPostingJsonMeta(username)
  const existingProfile = (existingMeta.profile ?? {}) as Record<string, unknown>
  const existingContact = (existingMeta.contact ?? {}) as Record<string, unknown>

  // 2. Merge profile fields — only include keys that were explicitly provided
  const mergedProfile: Record<string, unknown> = {
    ...existingProfile,
    ...(update.name !== undefined && { name: update.name }),
    ...(update.about !== undefined && { about: update.about }),
    ...(update.location !== undefined && { location: update.location }),
    ...(update.website !== undefined && { website: update.website }),
    version: 2,
  }

  // 3. Build contact object — merge existing, then apply updates, omit empty strings
  const contactUpdates: Record<string, string> = {}
  const contactKeys = ['facebook', 'telegram', 'discord', 'merchant_account'] as const
  for (const key of contactKeys) {
    const val = update[key]
    if (val !== undefined) {
      if (val.trim() !== '') {
        contactUpdates[key] = val.trim()
      }
      // empty string means "remove it" — so we omit it
    } else if (existingContact[key]) {
      // Not provided — keep whatever was there before
      contactUpdates[key] = existingContact[key] as string
    }
  }

  // 4. Build the final posting_json_metadata preserving all other top-level keys
  const newMeta: Record<string, unknown> = {
    ...existingMeta,
    profile: mergedProfile,
  }
  if (Object.keys(contactUpdates).length > 0) {
    newMeta.contact = contactUpdates
  } else {
    delete newMeta.contact
  }

  // 5. Merge payment_methods if supplied
  if (Array.isArray(update.payment_methods)) {
    const clean = [...new Set(update.payment_methods.map((m) => m.trim()).filter(Boolean))]
    newMeta.payment_methods = clean
  }

  return broadcast(username, buildAccountUpdate2(username, JSON.stringify(newMeta)), 'Posting')
}
