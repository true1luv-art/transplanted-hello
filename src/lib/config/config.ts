/**
 * Central application configuration.
 *
 * RULE: nothing else in the application reads `process.env` directly.
 * Every environment value is read here once, validated, and exposed typed.
 */

type NodeEnv = "development" | "test" | "production";
type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

function env(key: string): string | undefined {
  // `process` is not defined in every runtime (browser bundles), so guard.
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[key];
  return value === undefined || value === "" ? undefined : value;
}

function num(key: string, fallback: number): number {
  const raw = env(key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = env(key);
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export interface AppConfig {
  nodeEnv: NodeEnv;
  logLevel: LogLevel;
  /** Mongo connection string. Used by the Mongo storage driver (Phase 3). */
  databaseUrl: string;
  databaseName: string;
  apiPort: number;
  /** Smart-contract worker poll interval, ms. */
  smartContractInterval: number;
  /** Max processing attempts before a pending transaction is failed permanently. */
  smartContractMaxAttempts: number;
  /** Simulated blockchain latency, ms. */
  blockchainLatency: number;
  /**
   * Which blockchain implementation the backend uses.
   * - `mock` : MockBlockchainService (default, no network, no keys)
   * - `hive` : HiveBlockchainService -> lib/chain/hive.ts -> Hive
   */
  blockchainDriver: "mock" | "hive";
  /** Seed the database automatically when it is empty (development only). */
  autoSeed: boolean;
  /** Development user used until Hive Keychain auth lands in Phase 3. */
  devUser: string;
  /**
   * Hive blockchain configuration (Phase 6 backend foundation).
   * SERVER-ONLY values (`activeKey`) must never reach the browser bundle.
   */
  hive: {
    /** Ordered list of RPC nodes handed to the dHive client. */
    rpcNodes: string[];
    /** "mainnet" | "testnet" — selects chain id / address prefix defaults. */
    network: "mainnet" | "testnet";
    /** Chain id override; empty means use the dHive default for the network. */
    chainId: string;
    /** Address prefix override; empty means use the dHive default. */
    addressPrefix: string;
    /** Hive account the backend broadcasts from. */
    account: string;
    /** Public platform account receiving fees. */
    platformAccount: string;
    /** Platform wallet/market account. */
    walletAccount: string;
    /** SERVER-ONLY active key used for backend signing. Never expose. */
    activeKey: string;
    /** RPC timeout, ms. */
    timeout: number;
    /** Failover attempts across the configured nodes. */
    failoverThreshold: number;
    /** true when the backend may broadcast real transactions. */
    broadcastEnabled: boolean;
    /** Hive Engine node used for NFT / market queries (JSON-RPC base URL). */
    marketApi: string;
    /** custom_json id that routes an operation to the Hive Engine sidechain. */
    sidechainId: string;
    /** Token Hive Engine charges the NFT issuance fee in. */
    nftFeeSymbol: string;
    /**
     * The ONE Hive NFT collection every application collection is issued into.
     * Application collections are virtual and live in the token properties.
     */
    platformNftSymbol: string;
    /** SERVER-ONLY Hive account that issues NFTs. Never exposed to the browser. */
    issuerAccount: string;
  };
  /** Mock Keychain behaviour. `reject` simulates a user declining the prompt. */
  keychain: {
    /** "approve" | "reject" — default authorization outcome of MockKeychain. */
    defaultOutcome: "approve" | "reject";
    /** Simulated signing latency, ms. */
    latency: number;
  };
  /** Asset storage (Mock IPFS in Phase 2.5B, Pinata/Kubo/Filebase in Phase 3). */
  storage: {
    provider: "mock-ipfs";
    /** Simulated per-upload latency, ms. */
    uploadLatency: number;
    /** 0..1 — simulated per-upload failure rate, used to exercise retries. */
    failureRate: number;
    /** Max size of a single NFT asset file, bytes. */
    maxAssetFileSize: number;
    /** Max size of the collection artwork, bytes. */
    maxCollectionAssetSize: number;
    /** Max number of NFT asset files per collection. */
    maxNftAssets: number;
    /** Accepted image mime types. */
    supportedImageTypes: string[];
    /** Accepted file extensions (lowercase, with dot). */
    supportedExtensions: string[];
  };
  fees: {
    /**
     * Cost, in HIVE, charged per mintable slot when a collection is deployed.
     * creationCost = maxSupply x NFT_CREATION_COST_PER_MINT
     */
    nftCreationCostPerMint: number;
    nftCreationCurrency: "HIVE";
    /** Platform cut of every mint, in percent (e.g. 5 = 5%). */
    platformMintFeePercent: number;
    /** Platform cut of every marketplace sale, in percent. */
    marketplaceFeePercent: number;
    platformAccount: string;
    marketAccount: string;
  };
}

export const config: AppConfig = {
  nodeEnv: (env("NODE_ENV") as NodeEnv | undefined) ?? "development",
  logLevel: (env("LOG_LEVEL") as LogLevel | undefined) ?? "info",
  databaseUrl: env("DATABASE_URL") ?? "mongodb://127.0.0.1:27017",
  databaseName: env("DATABASE_NAME") ?? "hivemint",
  apiPort: num("API_PORT", 4000),
  smartContractInterval: num(
    "SMART_CONTRACT_POLL_INTERVAL_MS",
    num("SMART_CONTRACT_INTERVAL", 1500),
  ),
  smartContractMaxAttempts: num("SMART_CONTRACT_MAX_ATTEMPTS", 3),
  blockchainLatency: num("BLOCKCHAIN_LATENCY", 400),
  blockchainDriver:
    (env("BLOCKCHAIN_DRIVER") as AppConfig["blockchainDriver"] | undefined) ?? "mock",
  autoSeed: bool("AUTO_SEED", true),
  devUser: env("DEV_USER") ?? "rhiaji",
  hive: {
    rpcNodes: (env("HIVE_RPC_NODES") ?? env("HIVE_RPC_URL") ?? "https://api.hive.blog")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean),
    network: (env("HIVE_NETWORK") as "mainnet" | "testnet" | undefined) ?? "mainnet",
    chainId: env("HIVE_CHAIN_ID") ?? "",
    addressPrefix: env("HIVE_ADDRESS_PREFIX") ?? "",
    account: env("HIVE_ACCOUNT") ?? "",
    platformAccount: env("PLATFORM_ACCOUNT") ?? "hivemint",
    walletAccount: env("MARKET_ACCOUNT") ?? "hivemint-market",
    activeKey: env("HIVE_ACTIVE_KEY") ?? "",
    timeout: num("HIVE_RPC_TIMEOUT", 5000),
    failoverThreshold: num("HIVE_FAILOVER_THRESHOLD", 3),
    broadcastEnabled: bool("HIVE_BROADCAST_ENABLED", false),
    marketApi: env("HIVE_ENGINE_API") ?? "https://api.hive-engine.com/rpc",
    sidechainId: env("HIVE_SIDECHAIN_ID") ?? "ssc-mainnet-hive",
    nftFeeSymbol: env("HIVE_NFT_FEE_SYMBOL") ?? "BEE",
    platformNftSymbol: (env("PLATFORM_NFT_SYMBOL") ?? "").trim().toUpperCase(),
    issuerAccount: (env("ISSUER_ACCOUNT") ?? "").trim().toLowerCase(),
  },
  keychain: {
    defaultOutcome:
      (env("KEYCHAIN_DEFAULT_OUTCOME") as "approve" | "reject" | undefined) ?? "approve",
    latency: num("KEYCHAIN_LATENCY", 120),
  },
  storage: {
    provider: "mock-ipfs",
    uploadLatency: num("STORAGE_UPLOAD_LATENCY", 25),
    failureRate: num("STORAGE_FAILURE_RATE", 0),
    maxAssetFileSize: num("MAX_ASSET_FILE_SIZE", 10 * 1024 * 1024),
    maxCollectionAssetSize: num("MAX_COLLECTION_ASSET_SIZE", 15 * 1024 * 1024),
    maxNftAssets: num("MAX_NFT_ASSETS", 10_000),
    supportedImageTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    supportedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
  },
  fees: {
    nftCreationCostPerMint: num("NFT_CREATION_COST_PER_MINT", 0.1),
    nftCreationCurrency: "HIVE",
    platformMintFeePercent: num("PLATFORM_MINT_FEE_PERCENT", 5),
    marketplaceFeePercent: num("MARKETPLACE_FEE_PERCENT", 2.5),
    platformAccount: env("PLATFORM_ACCOUNT") ?? "hivemint",
    marketAccount: env("MARKET_ACCOUNT") ?? "hivemint-market",
  },
};

export const isProduction = config.nodeEnv === "production";

const round3 = (value: number) => Number(value.toFixed(3));

/** Collection deployment cost: maxSupply x NFT_CREATION_COST_PER_MINT. */
export function collectionCreationCost(maxSupply: number): number {
  return round3(maxSupply * config.fees.nftCreationCostPerMint);
}

/** Splits a mint payment into the platform cut and the creator payout. */
export function splitMintPayment(mintPrice: number): {
  mintPrice: number;
  platformFee: number;
  creatorShare: number;
  total: number;
} {
  const platformFee = round3(mintPrice * (config.fees.platformMintFeePercent / 100));
  return {
    mintPrice: round3(mintPrice),
    platformFee,
    creatorShare: round3(mintPrice - platformFee),
    total: round3(mintPrice),
  };
}

/** Splits a marketplace sale into the marketplace fee and the seller payout. */
export function splitSalePayment(price: number): {
  price: number;
  fee: number;
  sellerProceeds: number;
  total: number;
} {
  const fee = round3(price * (config.fees.marketplaceFeePercent / 100));
  return {
    price: round3(price),
    fee,
    sellerProceeds: round3(price - fee),
    total: round3(price + fee),
  };
}

/* ------------------------------------------------------------------ *
 * Backend configuration diagnostics (never exposes secret values)
 * ------------------------------------------------------------------ */

export interface ConfigIssue {
  level: "error" | "warning";
  key: string;
  message: string;
}

export interface ConfigDiagnostics {
  valid: boolean;
  nodeEnv: NodeEnv;
  database: { driver: "mongodb"; name: string; configured: boolean };
  blockchain: {
    driver: AppConfig["blockchainDriver"];
    network: string;
    rpcNodes: number;
    account: string;
    platformAccount: string;
    walletAccount: string;
    /** presence only — the key value is never revealed */
    activeKeyConfigured: boolean;
    broadcastEnabled: boolean;
  };
  issues: ConfigIssue[];
}

/**
 * Validates the backend configuration. Reports *presence*, never values:
 * private keys, connection strings with credentials and passwords are
 * deliberately excluded from the result.
 */
export function getConfigDiagnostics(): ConfigDiagnostics {
  const issues: ConfigIssue[] = [];
  const { hive } = config;

  if (!config.databaseUrl) {
    issues.push({ level: "error", key: "DATABASE_URL", message: "DATABASE_URL is empty" });
  }
  if (!config.databaseName) {
    issues.push({ level: "error", key: "DATABASE_NAME", message: "Database name is empty" });
  }
  if (hive.rpcNodes.length === 0) {
    issues.push({ level: "error", key: "HIVE_RPC_NODES", message: "No Hive RPC node configured" });
  }
  if (config.blockchainDriver === "hive") {
    if (!hive.account) {
      issues.push({
        level: "error",
        key: "HIVE_ACCOUNT",
        message: "Hive driver selected but HIVE_ACCOUNT is empty",
      });
    }
    if (hive.broadcastEnabled && !hive.activeKey) {
      issues.push({
        level: "error",
        key: "HIVE_ACTIVE_KEY",
        message: "Broadcasting is enabled but no server active key is configured",
      });
    }
    if (!hive.broadcastEnabled) {
      issues.push({
        level: "warning",
        key: "HIVE_BROADCAST_ENABLED",
        message: "Hive driver is read-only: broadcasting is disabled",
      });
    }
  }
  if (config.blockchainDriver === "mock" && hive.activeKey) {
    issues.push({
      level: "warning",
      key: "HIVE_ACTIVE_KEY",
      message: "A server active key is configured while the mock blockchain driver is active",
    });
  }

  return {
    valid: issues.every((i) => i.level !== "error"),
    nodeEnv: config.nodeEnv,
    database: {
      driver: "mongodb",
      name: config.databaseName,
      configured: Boolean(config.databaseUrl),
    },
    blockchain: {
      driver: config.blockchainDriver,
      network: hive.network,
      rpcNodes: hive.rpcNodes.length,
      account: hive.account,
      platformAccount: hive.platformAccount,
      walletAccount: hive.walletAccount,
      activeKeyConfigured: Boolean(hive.activeKey),
      broadcastEnabled: hive.broadcastEnabled,
    },
    issues,
  };
}

/** true when the backend configuration has no blocking errors. */
export function isBackendConfigValid(): boolean {
  return getConfigDiagnostics().valid;
}

/* ------------------------------------------------------------------ *
 * SERVER-ONLY issuer credentials
 *
 * Read LAZILY (never at module scope): the serverless runtime injects the
 * environment per request, and a module-scope read would both be empty there
 * and risk the value being captured in a bundle. Callers must only invoke
 * these from a server-only boundary (a `createServerFn` handler).
 * ------------------------------------------------------------------ */

export interface IssuerCredentials {
  /** Hive account authorised to issue into the platform NFT symbol. */
  account: string;
  /** Active private key of the issuer account. NEVER log or return this. */
  key: string;
  /** Platform Hive NFT symbol, e.g. TESTNFTS. */
  symbol: string;
}

/** Platform Hive NFT symbol, safe to read anywhere. */
export function getPlatformNftSymbol(): string {
  return (env("PLATFORM_NFT_SYMBOL") ?? config.hive.platformNftSymbol ?? "").trim().toUpperCase();
}

/** true when ISSUER_ACCOUNT, ISSUER_KEYS and PLATFORM_NFT_SYMBOL are all set. */
export function isIssuerConfigured(): boolean {
  return Boolean(env("ISSUER_ACCOUNT") && env("ISSUER_KEYS") && getPlatformNftSymbol());
}

/**
 * Loads the issuer credentials from the environment. Server-only.
 * Throws with a message that never contains the key itself.
 */
export function getIssuerCredentials(): IssuerCredentials {
  const account = (env("ISSUER_ACCOUNT") ?? "").trim().toLowerCase();
  // ISSUER_KEYS may hold a comma separated list; the first entry is the signer.
  const key = (env("ISSUER_KEYS") ?? "").split(",")[0]?.trim() ?? "";
  const symbol = getPlatformNftSymbol();
  const missing = [
    account ? null : "ISSUER_ACCOUNT",
    key ? null : "ISSUER_KEYS",
    symbol ? null : "PLATFORM_NFT_SYMBOL",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Hive issuer is not configured: missing ${missing.join(", ")}`);
  }
  return { account, key, symbol };
}
