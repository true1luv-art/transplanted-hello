import type { GeneratedToken } from "@/features/lib/traits/types";
import type { Collection } from "@/features/types/domain/collections";
import type { NFT } from "@/features/types/domain/nfts";

/**
 * Service abstraction layer.
 *
 * The UI only ever talks to these interfaces. Today they are backed by
 * in-memory mock implementations; later the same interfaces will be backed by:
 *
 *   Frontend -> SDK -> API -> HiveService -> DHive / Hive Engine -> Hive
 *   Frontend -> SDK -> API -> DatabaseService -> MongoDB
 *
 * The frontend never imports a database driver or a chain client directly.
 */

export interface HiveTransferResult {
  txId: string;
  success: boolean;
  blockNumber: number;
}

/** Result of an `nft_issue` operation. The chain owns the token id. */
export interface HiveIssueResult extends HiveTransferResult {
  /** REAL token id assigned by the blockchain — never derived locally. */
  tokenId: number;
}

export interface HiveService {
  /** Simulates a Hive wallet connection (Keychain later). */
  connect(username?: string): Promise<{ username: string; balance: number }>;
  disconnect(): Promise<void>;
  getBalance(username: string): Promise<number>;
  transfer(from: string, to: string, amount: number, memo: string): Promise<HiveTransferResult>;
  /**
   * Hive Engine NFT issue operation (mocked). The blockchain assigns the token
   * id; pass one only when re-issuing an already known token.
   */
  issueNft(collectionSymbol: string, to: string, tokenId?: number): Promise<HiveIssueResult>;
}

export interface DatabaseService {
  /** Indexing layer — MongoDB in production. */
  saveCollection(collection: Collection): Promise<Collection>;
  saveNft(nft: NFT): Promise<NFT>;
  /** Next chronological mint number inside a collection. */
  nextMintedNumber(collection: Collection): Promise<number>;
}

export interface MarketplaceService {
  quoteMint(
    collection: Collection,
  ): Promise<{ mintPrice: number; platformFee: number; total: number }>;
  quoteListing(price: number): Promise<{ feeRate: number; fee: number; receive: number }>;
  quotePurchase(price: number): Promise<{ price: number; fee: number; total: number }>;
  /**
   * Rolls a full weighted trait combination. Rarity is derived from the
   * result — it is never an input.
   */
  generateToken(collection: Collection, tokenNumber: number): Promise<GeneratedToken>;
}
