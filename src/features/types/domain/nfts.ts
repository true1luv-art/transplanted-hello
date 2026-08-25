import type { HiveNftProperties } from "@/lib/chain/nft-properties";
import type { GeneratedTrait } from "@/features/lib/traits/types";

export interface NFTAttribute {
  trait: string;
  value: string | number;
}

export type NFTStatus = "Owned" | "Listed";

/** Mock mint transaction recorded the moment a token is minted. */
export interface NftMintTransaction {
  txId: string;
  type: "NFT_MINT";
  status: "confirmed";
}

/**
 * HiveMint has NO rarity tiers. Rarity is a numeric score (sum of
 * 1 / trait frequency) plus the resulting collection-wide rank.
 */
export interface NFT {
  id: string;
  collectionId: string;
  collectionName: string;
  /**
   * REAL blockchain NFT token id, assigned by Hive at mint time and read back
   * from the chain. `null` while the token is not minted. It is NOT derived
   * from the collection mint order nor from the file number.
   */
  tokenId: number | null;
  /**
   * Chronological mint number of this NFT INSIDE its own collection
   * (1 = first token minted in that collection). Assigned by the mint queue.
   */
  NFTMintedNumber: number | null;
  /** Blockchain-shaped custom properties; `metadata` is a JSON STRING. */
  properties: HiveNftProperties;
  /** Mock chain transaction that minted this token. */
  transaction?: NftMintTransaction | undefined;
  name: string;
  description: string;
  image: string;
  /** The actual generated traits behind this token. */
  traits: GeneratedTrait[];
  rarityScore: number;
  /** 1 = rarest in the collection. */
  rarityRank: number;
  /** Size of the ranked pool the rank was computed against. */
  rarityRankTotal: number;
  mintNumber: number;
  maxSupply: number;
  owner: string;
  attributes: NFTAttribute[];
  /** File and directory CIDs retained while this NFT is still unminted. */
  imageCid?: string | undefined;
  metadataCid?: string | undefined;
  imageRootCid?: string | undefined;
  metadataRootCid?: string | undefined;
  metadataUri: string;
  estimatedValue: number;
  createdAt: string;
  status: NFTStatus;
  /**
   * true for legacy MOCK tokens that were never issued on Hive. Real mints,
   * signed through Keychain, are always `false`.
   */
  mock?: boolean | undefined;
}
