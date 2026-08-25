// ── Test: login (placeholder) ───────────────────────────────────────────────
// NOTE: This is a placeholder test. It intentionally does NOT transact with the
// Hive blockchain or call the Keychain extension. It only validates the pure
// input-handling behaviour of the event. Replace/extend with Vitest mocks when
// a test runner is wired up.

import { execute } from './action'

export async function test(): Promise<void> {
  // Empty username should be rejected before any keychain interaction.
  try {
    await execute({ username: '   ' })
    console.error('[test:login] FAIL — expected empty username to throw')
  } catch {
    console.log('[test:login] PASS — empty username rejected')
  }

  // Placeholder for the happy path. Not executed against the blockchain.
  // Example (when mocked):
  //   const res = await execute({ username: 'alice' })
  //   expect(res.success).toBe(true)
  console.log('[test:login] placeholder — happy path not run against blockchain')
}
