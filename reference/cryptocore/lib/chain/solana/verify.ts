// src/lib/chain/solana/verify.ts
import nacl from "tweetnacl";
import bs58 from "bs58";

/**
 * Verifies a Solana signature against a message.
 * Returns true if the signature was produced by the private key for publicKey.
 */
export function verifySignature(
  publicKeyBase58: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const publicKey = bs58.decode(publicKeyBase58);
    const signature = bs58.decode(signatureBase58);
    return nacl.sign.detached.verify(new TextEncoder().encode(message), signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Verifies a deposit transaction signature on the public ledger.
 * For this skeleton we accept the caller's Solana tx signature as proof.
 * The worker will then verify it on-chain via getSignatureStatuses.
 */
export function verifyDepositMessage(wallet: string, nonce: string, signature: string): boolean {
  return verifySignature(wallet, `Deposit ${nonce}`, signature);
}
