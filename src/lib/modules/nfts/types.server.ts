import type { GeneratedTrait } from "@/features/lib/traits/types";
import type { NFTAttribute } from "@/features/lib/metadata";

export type NftDocumentStatus = "owned" | "listed" | "burned";

/**
 * INDEX of MINTED NFTs.
 *
 * The token itself lives on Hive — this document exists so the application can
 * look one up quickly (owner, collection, Hive NFT id, mint transaction,
 * metadata reference, cached market state). Unminted tokens are NOT here: they
 * live in `nft_assets` until a mint is verified.
 *
 * Hive is authoritative. Anything cached here can be revalidated from chain.
 */
export interface NftDocument {
  id: string;
  collectionId: string;
  collectionName: string;
  /** token number inside the collection */
  tokenId: number;
  /** Hive NFT identity, e.g. `SYMBOL:12`. */
  hiveNftId: string;
  name: string;
  description: string;
  image: string;
  owner: string;
  /** true when the record came from an imported collection package. */
  imported?: boolean | undefined;
  /** Original creator metadata, preserved verbatim. Never rewritten. */
  sourceMetadata?: Record<string, unknown> | undefined;
  mintNumber: number;
  /** Mint number inside the virtual collection. */
  NFTMintId: number;
  /** Real Hive NFT id, assigned by the chain at mint time. */
  NFTokenID?: number | null | undefined;
  maxSupply: number;
  metadataUri: string;
  /** ipfs:// image reference carried over from the nft_assets record. */
  imageUri?: string | undefined;
  /** id of the consumed `nft_assets` row this token was minted from. */
  assetId?: string | undefined;
  traits: GeneratedTrait[];
  /** Sum of 1 / probability across every trait. */
  rarityScore: number;
  /** 1 = rarest in the ranked pool. */
  rarityRank: number;
  rarityRankTotal: number;
  attributes: NFTAttribute[];
  estimatedValue: number;
  status: NftDocumentStatus;
  /* ---- chain provenance --------------------------------------------- */
  /** application transaction that produced this NFT — idempotency anchor */
  mintTransactionId: string;
  /** Hive transaction id of the verified mint */
  hiveTransactionId?: string | undefined;
  blockNumber?: number | undefined;
  /* ---- cached Hive market state (NEVER authoritative) ---------------- */
  isListed: boolean;
  listingPrice?: number | undefined;
  listingCurrency?: "HIVE" | undefined;
  listingSeller?: string | undefined;
  listedAt?: string | undefined;
  /** application transaction that produced the cached listing */
  listingTransactionId?: string | undefined;
  /** last time the cached market state was refreshed from Hive */
  marketSyncedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}
