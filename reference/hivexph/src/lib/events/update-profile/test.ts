// ── Test: update-profile (placeholder) ──────────────────────────────────────
// NOTE: Placeholder test. Does NOT transact with the Hive blockchain. When a
// Vitest runner is wired up, mock `@/lib/hive` (fetchPostingJsonMeta) and
// `@/lib/keychain` (broadcast) to assert the merged metadata payload.

export async function test(): Promise<void> {
  // Example (when mocked):
  //   vi.mock('@/lib/hive', () => ({ fetchPostingJsonMeta: async () => ({}) }))
  //   vi.mock('@/lib/keychain', () => ({ broadcast: async () => ({ success: true }) }))
  //   const res = await execute({ username: 'alice', update: { name: 'Alice' } })
  //   expect(res.success).toBe(true)
  console.log('[test:update-profile] placeholder — not run against blockchain')
}
