import type { NFT } from "@/features/types/domain/nfts";

export interface MintNftInput {
  collectionId: string;
}

export interface MintNftResult {
  nft: NFT;
  txId: string;
}

export interface TransferNftInput {
  nftId: string;
  to: string;
}
