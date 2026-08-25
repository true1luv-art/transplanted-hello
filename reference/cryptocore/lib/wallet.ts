import nacl from "tweetnacl";
import bs58 from "bs58";
import { Transaction } from "@solana/web3.js";
import { buildDepositTx, getWalletBalance } from "@/lib/api/client";

export interface KeyPair {
  address: string;
  secret: string;
}

export function generateKeyPair(): KeyPair {
  const pair = nacl.sign.keyPair();
  return {
    address: bs58.encode(pair.publicKey),
    secret: bs58.encode(pair.secretKey),
  };
}

export function keyPairFromSecret(secret: string): KeyPair {
  const secretKey = bs58.decode(secret);
  const pair = nacl.sign.keyPair.fromSecretKey(secretKey);
  return {
    address: bs58.encode(pair.publicKey),
    secret,
  };
}

export function signMessage(secret: string, message: string): string {
  const secretKey = bs58.decode(secret);
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, secretKey);
  return bs58.encode(signature);
}

export function isValidAddress(address: string): boolean {
  try {
    const bytes = bs58.decode(address);
    return bytes.length === 32;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * Browser wallet (Phantom) adapter
 * ------------------------------------------------------------------------- */

interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
  signAndSendTransaction: (transaction: Transaction) => Promise<{ signature: string }>;
}

export function getPhantomProvider(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const anyWindow = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
  };
  const provider = anyWindow.phantom?.solana ?? anyWindow.solana;
  return provider?.isPhantom ? provider : null;
}

export function isPhantomInstalled(): boolean {
  return getPhantomProvider() !== null;
}

export const PHANTOM_INSTALL_URL = "https://phantom.app/download";

export interface ConnectedWallet {
  address: string;
  signMessage: (message: string) => Promise<string>;
}

export async function connectPhantom(): Promise<ConnectedWallet> {
  const provider = getPhantomProvider();
  if (!provider) throw new Error("Phantom wallet not found");

  const { publicKey } = await provider.connect();
  const address = publicKey.toString();

  return {
    address,
    signMessage: async (message: string) => {
      const encoded = new TextEncoder().encode(message);
      const { signature } = await provider.signMessage(encoded, "utf8");
      return bs58.encode(signature);
    },
  };
}

export async function disconnectPhantom(): Promise<void> {
  try {
    await getPhantomProvider()?.disconnect();
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------------------
 * On-chain HASH token payments (deposits + marketplace purchases)
 *
 * These read NEXT_PUBLIC_ vars directly (Next.js inlines them at build time —
 * they must be referenced as literal `process.env.NEXT_PUBLIC_X`, never via a
 * dynamic key) so the browser can build/send real SPL token transfers without
 * ever touching the treasury's private key.
 * ------------------------------------------------------------------------- */

export function getGameMintAddress(): string {
  return process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
}

export function getTreasuryAddress(): string {
  return process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "";
}

/** Decodes a base64 string into bytes without relying on Node's `Buffer`. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** True once both the game token mint and treasury address are configured. */
export function isChainPaymentConfigured(): boolean {
  return isValidAddress(getGameMintAddress()) && isValidAddress(getTreasuryAddress());
}

export interface OnChainPayment {
  signature: string;
  amount: number;
}

/**
 * Signs and submits a real SPL token transfer of `amount` HASH tokens from the
 * connected Phantom wallet to the treasury. The unsigned transaction is built
 * SERVER-SIDE (via /api/wallet/build-tx, using our own Helius-backed RPC
 * connection) — the browser never talks to Solana RPC directly, so it never
 * hits public-endpoint 403s and never needs its own confirmation polling.
 * Resolves as soon as the wallet broadcasts the signed transaction; the
 * settlement worker verifies it on-chain before crediting the player.
 * Never used in demo mode — demo play never touches the chain.
 */
export async function payWithHashToken(recipient: string, amount: number): Promise<OnChainPayment> {
  const provider = getPhantomProvider();
  if (!provider) throw new Error("Phantom wallet not found");
  if (!provider.publicKey) throw new Error("Wallet not connected");
  if (!isValidAddress(recipient)) throw new Error("Treasury address is not configured");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");

  const built = await buildDepositTx(amount);
  if (!built.ok || !built.transaction) {
    throw new Error(built.error || "Could not prepare the deposit transaction");
  }

  const transaction = Transaction.from(base64ToBytes(built.transaction));
  const { signature } = await provider.signAndSendTransaction(transaction);

  return { signature, amount };
}

/** Reads the connected wallet's real on-chain HASH token balance (ui units). */
export async function getHashTokenBalance(owner: string): Promise<number> {
  if (!isValidAddress(owner)) return 0;
  const result = await getWalletBalance();
  return result.ok ? (result.balance ?? 0) : 0;
}
