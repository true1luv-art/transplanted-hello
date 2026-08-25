// src/lib/auth/login.server.ts
import { verifySignature } from "@/lib/chain/solana/verify";
import {
  createNonce,
  findNonce,
  markNonceUsed,
} from "@/lib/modules/login-nonces/repository.server";
import { createSession, type SessionPayload } from "./jwt";

export async function generateLoginChallenge(wallet: string): Promise<string> {
  const nonce = await createNonce(wallet);
  return nonce.nonce;
}

export async function verifyLoginSignature(
  wallet: string,
  signature: string,
): Promise<{ ok: boolean; token?: string; payload?: SessionPayload; error?: string }> {
  const nonce = await findNonce(wallet);
  if (!nonce || nonce.used || Date.now() > nonce.expiresAt) {
    return { ok: false, error: "Invalid or expired nonce" };
  }
  const valid = verifySignature(wallet, nonce.nonce, signature);
  if (!valid) return { ok: false, error: "Signature verification failed" };

  await markNonceUsed(wallet, signature);
  const username = wallet; // username resolved in a separate profile call after registration
  const token = await createSession({ wallet, username });
  return { ok: true, token, payload: { wallet, username } };
}
