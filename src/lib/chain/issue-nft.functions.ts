/**
 * SERVER BOUNDARY for the real Hive NFT issuance.
 *
 *   Mint Service (browser) -> issueNftOnHive (server fn) -> lib/chain/hive.ts -> dhive
 *
 * ISSUER_ACCOUNT / ISSUER_KEYS / PLATFORM_NFT_SYMBOL are read INSIDE the
 * handler only, so the issuer key never reaches the client bundle, the browser
 * or any response body.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const issueInput = z.object({
  /** Creator collection name, e.g. "Otters Outbreak". */
  collection: z.string().min(1).max(100),
  /** Creator collection symbol, e.g. "OO" — never the platform NFT symbol. */
  collectionSymbol: z.string().min(1).max(100),
  /** IPFS URI of the metadata JSON, e.g. "ipfs://Qm…/otters-1.json". */
  metadataUri: z
    .string()
    .min(5)
    .max(100, "The IPFS metadata URI exceeds the Hive Engine 100-character property limit"),
  /** Hive account receiving the token. */
  to: z.string().min(3),
});

export interface IssueNftOnHiveResult {
  txId: string;
  /** REAL Hive token id — null when the sidechain has not indexed it yet. */
  tokenId: number | null;
  /** PLATFORM Hive NFT contract symbol the token was issued into. */
  symbol: string;
  collection: string;
  /** Creator collection symbol written to `properties.symbol`. */
  collectionSymbol: string;
  /** IPFS metadata URI written to `properties.metadata`. */
  metadataUri: string;
  issuer: string;
  to: string;
  error?: string | undefined;
}

/** Broadcasts a real, issuer-signed `nft.issue` transaction to Hive. */
export const issueNftOnHive = createServerFn({ method: "POST" })
  .validator((data: unknown) => issueInput.parse(data))
  .handler(async ({ data }): Promise<IssueNftOnHiveResult> => {
    const { issueNftAsIssuer } = await import("./hive");
    const outcome = await issueNftAsIssuer({
      collection: data.collection,
      metadata: data.metadata,
      to: data.to,
    });
    return {
      txId: outcome.transactionId,
      tokenId: outcome.tokenId,
      symbol: outcome.symbol,
      collection: outcome.collection,
      issuer: outcome.issuer,
      to: outcome.to,
      error: outcome.error,
    };
  });

/** Non-secret readiness probe used by the UI to explain a missing setup. */
export const getHiveIssuerStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isIssuerConfigured, getPlatformNftSymbol } = await import("@/lib/config/config");
  const { getIssuerAccount } = await import("./hive");
  return {
    configured: isIssuerConfigured(),
    issuer: getIssuerAccount(),
    symbol: getPlatformNftSymbol(),
  };
});

/** Re-reads a broadcast issuance so a pending mint can recover its token id. */
export const readNftIssuance = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ txId: z.string().min(8), to: z.string().min(3) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getNftFromTransaction, getPlatformSymbol } = await import("./hive");
    const symbol = getPlatformSymbol();
    const outcome = await getNftFromTransaction(data.txId, { symbol, to: data.to });
    return { tokenId: outcome.tokenId, symbol, error: outcome.error };
  });
