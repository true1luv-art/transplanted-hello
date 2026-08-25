// src/lib/chain/solana/client.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { config } from "@/lib/config/config";

/**
 * $HASH is a pump.fun token, which mints on the Token-2022 program
 * (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb) rather than the classic SPL
 * Token program. Every getMint/getAccount/getAssociatedTokenAddress/transfer
 * call for this mint MUST pass this explicitly — the spl-token helpers
 * default to the classic program and will throw TokenInvalidAccountOwnerError
 * against a Token-2022 mint.
 */
export const HASH_TOKEN_PROGRAM_ID = TOKEN_2022_PROGRAM_ID;

/**
 * Resolves the real RPC endpoint to use. Prefers Helius (when HELIUS_API_KEY
 * is set) over the plain SOLANA_RPC_URL since public/shared RPC endpoints
 * aggressively rate-limit or outright block traffic (403 Access forbidden).
 * SERVER-ONLY — the Helius API key must never reach the browser bundle.
 */
export function resolveRpcUrl(): string {
  const { rpcUrl, heliusApiKey } = config.blockchain.solana;
  if (heliusApiKey) {
    const host = rpcUrl.includes("devnet") ? "devnet.helius-rpc.com" : "mainnet.helius-rpc.com";
    return `https://${host}/?api-key=${heliusApiKey}`;
  }
  return rpcUrl;
}

let _connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(resolveRpcUrl(), "confirmed");
  }
  return _connection;
}

export function getTreasuryPublicKey(): PublicKey {
  if (!config.blockchain.treasuryAddress) {
    throw new Error("TREASURY_ADDRESS is not set");
  }
  return new PublicKey(config.blockchain.treasuryAddress);
}

export function getMintPublicKey(): PublicKey {
  if (!config.blockchain.solana.mint) {
    throw new Error("CONTRACT_ADDRESS (mint) is not set");
  }
  return new PublicKey(config.blockchain.solana.mint);
}
