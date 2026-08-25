// src/lib/config/config.ts
// This is the ONLY file that reads process.env. All other files import from here.
// Solana-only — no multi-chain fallback.

export type SupportedChain = "solana";

export const config = {
  mongoUri: process.env["MONGODB_URI"]!,
  mongoDb: process.env["MONGODB_DB"] ?? "cryptocore",
  jwtSecret: process.env["JWT_SECRET"] ?? "changeme-dev-secret",

  withdrawal: {
    workerPollMs: 5000,
    maxRetries: 8,
  },

  blockchain: {
    chain: "solana" as SupportedChain,
    // Address/mint are public on-chain data, so it's safe to fall back to the
    // NEXT_PUBLIC_ variants exposed to the client. TREASURY_KEY is a secret
    // and must NEVER have a NEXT_PUBLIC_ fallback.
    treasuryAddress:
      process.env["TREASURY_ADDRESS"] ?? process.env["NEXT_PUBLIC_TREASURY_ADDRESS"] ?? "",
    treasuryKey: process.env["TREASURY_KEY"] ?? "",
    contractAddress:
      process.env["CONTRACT_ADDRESS"] ?? process.env["NEXT_PUBLIC_CONTRACT_ADDRESS"] ?? "",

    solana: {
      rpcUrl: process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com",
      heliusApiKey: process.env["HELIUS_API_KEY"] ?? "",
      mint: process.env["CONTRACT_ADDRESS"] ?? process.env["NEXT_PUBLIC_CONTRACT_ADDRESS"] ?? "",
    },
  },
} as const;
