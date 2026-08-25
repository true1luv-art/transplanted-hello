// ── Event: publish-merchant-post ─────────────────────────────────────────────
// Use-case: broadcast a "comment" operation as a merchant application post. The
// body is pre-filled with the user's display name, username and payment methods.
// After confirming, the user copies the resulting post URL into Account Settings
// as their merchant_account link so offers can be unlocked.

import { broadcast, type KeychainResponse } from '@/lib/keychain'
import { buildPost } from '@/lib/config/keychain'

export interface PublishMerchantPostInput {
  username: string
  displayName: string
  paymentMethods?: string[]
}

export async function execute(input: PublishMerchantPostInput): Promise<KeychainResponse> {
  const { username, displayName, paymentMethods = [] } = input

  const pmList =
    paymentMethods.length > 0
      ? paymentMethods.map((m) => `* ${m}`).join('\n')
      : '* GCash\n* Maya\n* Bank Transfer'

  const body = `# Merchant Profile\n\nHello,\n\nI am **${displayName || username}** (@${username}) and I am applying to become a merchant on this marketplace.\n\n## Trading Information\n\n* Hive Account: @${username}\n* Country: Philippines\n* Supported Currency: PHP\n* Payment Methods:\n${pmList}\n\n## Merchant Declaration\n\nI agree to follow the marketplace rules and conduct trades honestly and professionally. I understand that all reviews submitted to this profile are public and permanently recorded on the Hive blockchain.\n\n## Reviews\n\nTo leave a review for this merchant, create a comment on this post with the comment body containing a valid JSON string in the following format:\n\n\`\`\`json\n{\n  "version": 1,\n  "rating": 5,\n  "feedback": "fast_payment"\n}\n\`\`\`\n\n### Rating\n\nThe rating must be a number from **1** to **5**.\n\n### Preset Feedback Options\n\n* fast_payment\n* fast_release\n* trusted_trader\n* slow_payment\n* slow_release\n* unresponsive_trader\n\n### Custom Feedback\n\nYou may also provide custom feedback:\n\n\`\`\`json\n{\n  "version": 1,\n  "rating": 4,\n  "feedback": "Seller was polite and completed the trade quickly."\n}\n\`\`\`\n\nOnly comments that contain valid review JSON may be displayed by the marketplace application.\n\nThank you for reviewing this merchant.\n`

  const jsonMetadata = JSON.stringify({
    app: 'peakd/2026.6.6',
    format: 'markdown',
    description: 'This is Merchants Application for HiveX PH',
    tags: ['p2p'],
    users: [],
    image: [],
  })

  return broadcast(
    username,
    buildPost(username, 'merchant-application', 'p2p', 'Merchant Application', body, jsonMetadata),
    'Posting',
  )
}
