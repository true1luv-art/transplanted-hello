import type { Listing } from "@/features/types/domain/marketplace";

export interface ListNftInput {
  nftId: string;
  price: number;
}

export type ListNftResult = Listing;

export interface CancelListingInput {
  listingId: string;
}

export interface BuyNftInput {
  listingId: string;
}

export interface BuyNftResult {
  nftId: string;
  txId: string;
  paid: number;
}
