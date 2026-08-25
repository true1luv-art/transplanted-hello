// ─────────────────────────────────────────────────────────────────────────────
// lib/config/keychain.ts
//
// Central home for all Hive / Hive Engine JSON data structures.
// Defines the chain ID, shared types, and builder functions for every
// custom_json payload and L1 broadcast operation used in the app.
//
// These describe WHAT gets broadcast.
// lib/keychain.ts owns HOW it gets broadcast (browser primitives).
// ─────────────────────────────────────────────────────────────────────────────

// ── Chain ID ──────────────────────────────────────────────────────────────────

export const HE_CHAIN_ID = 'ssc-mainnet-hive'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface CustomJsonPayload {
  contractName: string
  contractAction: string
  contractPayload: Record<string, unknown>
}

// ── tokens contract ───────────────────────────────────────────────────────────

export const buildStake = (
  to: string,
  symbol: string,
  quantity: string,
): CustomJsonPayload => ({
  contractName: 'tokens',
  contractAction: 'stake',
  contractPayload: { to, symbol, quantity },
})

export const buildUnstake = (
  symbol: string,
  quantity: string,
): CustomJsonPayload => ({
  contractName: 'tokens',
  contractAction: 'unstake',
  contractPayload: { symbol, quantity },
})

export const buildDelegate = (
  to: string,
  symbol: string,
  quantity: string,
): CustomJsonPayload => ({
  contractName: 'tokens',
  contractAction: 'delegate',
  contractPayload: { to, symbol, quantity },
})

export const buildTransferHE = (
  to: string,
  symbol: string,
  quantity: string,
  memo = '',
): CustomJsonPayload => ({
  contractName: 'tokens',
  contractAction: 'transfer',
  contractPayload: { to, symbol, quantity, memo },
})

// ── marketpools contract ──────────────────────────────────────────────────────

export const buildSwap = (
  tokenPair: string,
  tokenSymbol: string,
  tokenAmount: string,
  minAmountOut: string,
): CustomJsonPayload => ({
  contractName: 'marketpools',
  contractAction: 'swapTokens',
  contractPayload: { tokenPair, tokenSymbol, tokenAmount, minAmountOut, tradeType: 'exactInput' },
})

export const buildCreatePool = (tokenPair: string): CustomJsonPayload => ({
  contractName: 'marketpools',
  contractAction: 'createPool',
  contractPayload: { tokenPair, isSignedWithActiveKey: true },
})

export const buildAddLiquidity = (
  tokenPair: string,
  baseQuantity: string,
  quoteQuantity: string,
  maxPriceImpact: string,
  maxDeviation = '0',
): CustomJsonPayload => ({
  contractName: 'marketpools',
  contractAction: 'addLiquidity',
  contractPayload: { tokenPair, baseQuantity, quoteQuantity, maxPriceImpact, maxDeviation },
})

export const buildRemoveLiquidity = (
  tokenPair: string,
  sharesOut: string,
): CustomJsonPayload => ({
  contractName: 'marketpools',
  contractAction: 'removeLiquidity',
  contractPayload: { tokenPair, sharesOut },
})

// ── market contract ───────────────────────────────────────────────────────────

export const buildBuyOrder = (
  symbol: string,
  quantity: string,
  price: string,
): CustomJsonPayload => ({
  contractName: 'market',
  contractAction: 'buy',
  contractPayload: { symbol, quantity, price },
})

export const buildSellOrder = (
  symbol: string,
  quantity: string,
  price: string,
): CustomJsonPayload => ({
  contractName: 'market',
  contractAction: 'sell',
  contractPayload: { symbol, quantity, price },
})

export const buildCancelOrder = (
  type: 'buy' | 'sell',
  id: string,
): CustomJsonPayload => ({
  contractName: 'market',
  contractAction: 'cancel',
  contractPayload: { type, id },
})

// ── Hive L1: account_update2 ──────────────────────────────────────────────────

export const buildAccountUpdate2 = (
  account: string,
  posting_json_metadata: string,
): unknown[] => [
  [
    'account_update2',
    {
      account,
      json_metadata: '',
      posting_json_metadata,
      extensions: [],
    },
  ],
]

// ── Hive L1: comment (top-level post) ────────────────────────────────────────

export const buildPost = (
  author: string,
  permlink: string,
  parentPermlink: string,
  title: string,
  body: string,
  jsonMetadata: string,
): unknown[] => [
  [
    'comment',
    {
      parent_author: '',
      parent_permlink: parentPermlink,
      author,
      permlink,
      title,
      body,
      json_metadata: jsonMetadata,
    },
  ],
]

// ── Hive L1: comment (reply / review) ────────────────────────────────────────

export const buildReply = (
  parentAuthor: string,
  parentPermlink: string,
  author: string,
  permlink: string,
  body: string,
  jsonMetadata: string,
): unknown[] => [
  [
    'comment',
    {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author,
      permlink,
      title: '',
      body,
      json_metadata: jsonMetadata,
    },
  ],
]
