export interface Listing {
  id: string;
  nftId: string;
  seller: string;
  price: number;
  currency: "HIVE";
  listedAt: string;
  featured: boolean;
}

export interface MintQuote {
  mintPrice: number;
  platformFee: number;
  total: number;
}

export interface ListingQuote {
  feeRate: number;
  fee: number;
  receive: number;
}

export interface PurchaseQuote {
  price: number;
  fee: number;
  total: number;
}
