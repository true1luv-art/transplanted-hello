// ── Event: submit-review ──────────────────────────────────────────────────────
// Use-case: post a comment on a merchant's application post where the body is a
// JSON-stringified { merchant_review: {...} } payload. Only valid review JSON is
// surfaced by the marketplace.

import { broadcast, type KeychainResponse } from '@/lib/keychain'
import { buildReply } from '@/lib/config/keychain'

export interface SubmitReviewInput {
  reviewer: string
  merchantAuthor: string
  merchantPermlink: string
  rating: number
  feedback: string
}

export async function execute(input: SubmitReviewInput): Promise<KeychainResponse> {
  const { reviewer, merchantAuthor, merchantPermlink, rating, feedback } = input

  const body = JSON.stringify({
    merchant_review: {
      version: 1,
      rating,
      feedback: feedback.trim(),
    },
  })

  // Permlink must be unique — use merchant + timestamp
  const permlink = `review-${merchantAuthor}-${Date.now()}`

  return broadcast(
    reviewer,
    buildReply(
      merchantAuthor,
      merchantPermlink,
      reviewer,
      permlink,
      body,
      JSON.stringify({ app: 'hivep2p/1.0', tags: ['p2p'] }),
    ),
    'Posting',
  )
}
