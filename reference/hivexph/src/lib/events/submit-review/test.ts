// ── Test: submit-review (placeholder) ───────────────────────────────────────
// NOTE: Placeholder test. Does NOT transact with the Hive blockchain. Mock
// `@/lib/keychain` (broadcast) to assert the review JSON body is well-formed.

export async function test(): Promise<void> {
  // Example (when mocked): body parses to { merchant_review: { version: 1, ... } }.
  console.log('[test:submit-review] placeholder — not run against blockchain')
}
