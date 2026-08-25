// src/lib/chain/solana/verify-deposit.ts
// Verifies that a player really sent the game's SPL token to the treasury.
// SERVER-ONLY.

import { config } from "@/lib/config/config";
import { getSolanaConnection } from "./client";

export interface DepositVerification {
  ok: boolean;
  amount?: number;
  error?: string;
  code?: "NOT_CONFIRMED" | "INVALID";
}

/**
 * Confirms `txId` on-chain and checks that the treasury's token account for the
 * configured mint gained at least `expectedAmount`, funded by `expectedWallet`.
 */
export async function verifyDepositFromPlayer(
  txId: string,
  expectedWallet: string,
  expectedAmount: number,
): Promise<DepositVerification> {
  const treasury = config.blockchain.treasuryAddress;
  const mint = config.blockchain.solana.mint;
  if (!treasury) return { ok: false, code: "INVALID", error: "TREASURY_ADDRESS is not set" };
  if (!mint) return { ok: false, code: "INVALID", error: "CONTRACT_ADDRESS (mint) is not set" };

  const connection = getSolanaConnection();

  const statuses = await connection.getSignatureStatuses([txId]);
  const status = statuses.value[0];
  if (!status) return { ok: false, code: "NOT_CONFIRMED", error: "Transaction not seen yet" };
  if (status.err) return { ok: false, code: "INVALID", error: "Transaction failed on-chain" };
  if (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized") {
    return { ok: false, code: "NOT_CONFIRMED", error: "Transaction not confirmed yet" };
  }

  const tx = await connection.getParsedTransaction(txId, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta)
    return { ok: false, code: "NOT_CONFIRMED", error: "Transaction details unavailable" };
  if (tx.meta.err) return { ok: false, code: "INVALID", error: "Transaction failed on-chain" };

  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  const uiAmount = (rows: typeof post, owner: string): number => {
    const row = rows.find((b) => b.owner === owner && b.mint === mint);
    return row ? Number(row.uiTokenAmount.uiAmountString ?? 0) : 0;
  };

  const treasuryDelta = uiAmount(post, treasury) - uiAmount(pre, treasury);
  if (treasuryDelta <= 0) {
    return { ok: false, code: "INVALID", error: "Treasury token balance did not increase" };
  }

  const payerDelta = uiAmount(post, expectedWallet) - uiAmount(pre, expectedWallet);
  const signerKeys = tx.transaction.message.accountKeys
    .filter((k) => k.signer)
    .map((k) => k.pubkey.toBase58());
  if (payerDelta >= 0 && !signerKeys.includes(expectedWallet)) {
    return { ok: false, code: "INVALID", error: "Deposit was not funded by the claiming wallet" };
  }

  // Allow a tiny rounding tolerance from UI-amount string conversion.
  if (treasuryDelta + 1e-9 < expectedAmount) {
    return {
      ok: false,
      code: "INVALID",
      error: `Deposit amount mismatch: on-chain ${treasuryDelta}, claimed ${expectedAmount}`,
    };
  }

  return { ok: true, amount: treasuryDelta };
}
