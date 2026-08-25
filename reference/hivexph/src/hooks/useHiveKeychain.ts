
import { useCallback } from 'react'
import type { KeychainResponse } from '@/lib/keychain'
import type { OffersValues, PaymentMethodsValues } from '@/lib/context/schemas'

// Event actions — each encapsulates one application use-case.
import { execute as loginAction } from '@/lib/events/login/action'
import {
  execute as updateProfileAction,
  type HiveProfileUpdate,
} from '@/lib/events/update-profile/action'
import { execute as updateOffersAction } from '@/lib/events/update-offers/action'
import { execute as updatePaymentMethodsAction } from '@/lib/events/update-payment-methods/action'
import { execute as activateOffersAction } from '@/lib/events/activate-offers/action'
import { execute as publishMerchantPostAction } from '@/lib/events/publish-merchant-post/action'
import { execute as submitReviewAction } from '@/lib/events/submit-review/action'
import { execute as transferTokensAction } from '@/lib/events/transfer-tokens/action'
import { execute as transferHeTokensAction } from '@/lib/events/transfer-he-tokens/action'
import { execute as stakeHeTokensAction } from '@/lib/events/stake-he-tokens/action'
import { execute as unstakeHeTokensAction } from '@/lib/events/unstake-he-tokens/action'
import { execute as delegateHeTokensAction } from '@/lib/events/delegate-he-tokens/action'
import { execute as swapTokensAction } from '@/lib/events/swap-tokens/action'

// Re-export shared types so existing consumers keep working.
export type { KeychainResponse } from '@/lib/keychain'
export type { HiveProfileUpdate } from '@/lib/events/update-profile/action'

// ── Return type ───────────────────────────────────────────────────────────────
interface UseHiveKeychainReturn {
  login: (username: string) => Promise<KeychainResponse>
  updateProfile: (username: string, profile: HiveProfileUpdate) => Promise<KeychainResponse>
  updateOffers: (username: string, offers: OffersValues) => Promise<KeychainResponse>
  updatePaymentMethods: (username: string, methods: PaymentMethodsValues) => Promise<KeychainResponse>
  activateOffers: (username: string) => Promise<KeychainResponse>
  publishMerchantPost: (username: string, displayName: string, paymentMethods?: string[]) => Promise<KeychainResponse>
  submitReview: (
    reviewer: string,
    merchantAuthor: string,
    merchantPermlink: string,
    rating: number,
    feedback: string,
  ) => Promise<KeychainResponse>
  transferHandler: (
    username: string,
    to: string,
    amount: number,
    memo: string,
    currency?: string,
  ) => Promise<KeychainResponse>
  swapTokens: (
    username: string,
    tokenPair: string,
    tokenSymbol: string,
    tokenAmount: string,
    minAmountOut: string,
  ) => Promise<KeychainResponse>
  transferHeTokens: (
    username: string,
    to: string,
    symbol: string,
    amount: number,
    precision: number,
    memo?: string,
  ) => Promise<KeychainResponse>
  stakeHeTokens: (
    username: string,
    to: string,
    symbol: string,
    quantity: string,
  ) => Promise<KeychainResponse>
  unstakeHeTokens: (
    username: string,
    symbol: string,
    quantity: string,
  ) => Promise<KeychainResponse>
  delegateHeTokens: (
    username: string,
    to: string,
    symbol: string,
    quantity: string,
  ) => Promise<KeychainResponse>
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// Thin React adapter over the `/lib/events/*` use-cases. The hook only binds the
// event actions to stable callbacks — all business logic lives in the events.
export function useHiveKeychain(): UseHiveKeychainReturn {
  const login = useCallback(
    (username: string) => loginAction({ username }),
    [],
  )

  const updateProfile = useCallback(
    (username: string, profile: HiveProfileUpdate) =>
      updateProfileAction({ username, update: profile }),
    [],
  )

  const updateOffers = useCallback(
    (username: string, offers: OffersValues) => updateOffersAction({ username, offers }),
    [],
  )

  const updatePaymentMethods = useCallback(
    (username: string, methods: PaymentMethodsValues) =>
      updatePaymentMethodsAction({ username, methods }),
    [],
  )

  const activateOffers = useCallback(
    (username: string) => activateOffersAction({ username }),
    [],
  )

  const publishMerchantPost = useCallback(
    (username: string, displayName: string, paymentMethods: string[] = []) =>
      publishMerchantPostAction({ username, displayName, paymentMethods }),
    [],
  )

  const submitReview = useCallback(
    (
      reviewer: string,
      merchantAuthor: string,
      merchantPermlink: string,
      rating: number,
      feedback: string,
    ) =>
      submitReviewAction({ reviewer, merchantAuthor, merchantPermlink, rating, feedback }),
    [],
  )

  const transferHandler = useCallback(
    (username: string, to: string, amount: number, memo: string, currency = 'HIVE') =>
      transferTokensAction({ username, to, amount, memo, currency }),
    [],
  )

  const swapTokens = useCallback(
    (
      username: string,
      tokenPair: string,
      tokenSymbol: string,
      tokenAmount: string,
      minAmountOut: string,
    ) => swapTokensAction({ username, tokenPair, tokenSymbol, tokenAmount, minAmountOut }),
    [],
  )

  const transferHeTokens = useCallback(
    (username: string, to: string, symbol: string, amount: number, precision: number, memo = '') =>
      transferHeTokensAction({ username, to, symbol, amount, precision, memo }),
    [],
  )

  const stakeHeTokens = useCallback(
    (username: string, to: string, symbol: string, quantity: string) =>
      stakeHeTokensAction({ username, to, symbol, quantity }),
    [],
  )

  const unstakeHeTokens = useCallback(
    (username: string, symbol: string, quantity: string) =>
      unstakeHeTokensAction({ username, symbol, quantity }),
    [],
  )

  const delegateHeTokens = useCallback(
    (username: string, to: string, symbol: string, quantity: string) =>
      delegateHeTokensAction({ username, to, symbol, quantity }),
    [],
  )

  return {
    login,
    updateProfile,
    updateOffers,
    updatePaymentMethods,
    activateOffers,
    publishMerchantPost,
    submitReview,
    transferHandler,
    swapTokens,
    transferHeTokens,
    stakeHeTokens,
    unstakeHeTokens,
    delegateHeTokens,
  }
}
