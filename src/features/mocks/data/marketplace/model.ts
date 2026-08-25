import { MARKETPLACE_FEE_RATE, PLATFORM_FEE_RATE } from "@/lib/constants";
import type { Collection } from "@/features/types/domain/collections";
import type { Listing, ListingQuote, MintQuote, PurchaseQuote } from "@/features/types/domain/marketplace";

/** Mint cost = mint price + platform fee. */
export function quoteMint(collection: Collection): MintQuote {
  const platformFee = Number((collection.mintPrice * PLATFORM_FEE_RATE).toFixed(2));
  return {
    mintPrice: collection.mintPrice,
    platformFee,
    total: Number((collection.mintPrice + platformFee).toFixed(2)),
  };
}

/** What a seller receives for a listing at `price`. */
export function quoteListing(price: number): ListingQuote {
  const fee = Number((price * MARKETPLACE_FEE_RATE).toFixed(2));
  return { feeRate: MARKETPLACE_FEE_RATE, fee, receive: Number((price - fee).toFixed(2)) };
}

/** What a buyer pays for a listing at `price`. */
export function quotePurchase(price: number): PurchaseQuote {
  const fee = Number((price * MARKETPLACE_FEE_RATE).toFixed(2));
  return { price, fee, total: Number((price + fee).toFixed(2)) };
}

/** Pure factory for a marketplace listing. */
export function buildListing(params: {
  id: string;
  nftId: string;
  seller: string;
  price: number;
}): Listing {
  return {
    id: params.id,
    nftId: params.nftId,
    seller: params.seller,
    price: params.price,
    currency: "HIVE",
    listedAt: new Date().toISOString(),
    featured: false,
  };
}

/** Creator share of a mint, in HIVE. */
export function creatorShare(collection: Collection, mintPrice: number): number {
  return Number((mintPrice * (collection.creatorFee / 100)).toFixed(2));
}
