import type { BuyNftInput, BuyNftResult } from "@/features/types/marketplace";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { collectionsRepository } from "@/features/mocks/data/collections/repository";
import { quotePurchase } from "@/features/mocks/data/marketplace/model";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { repriceAfterSale } from "@/features/mocks/data/nfts/model";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { hiveService } from "@/features/mocks/services";

/** Buys a listed NFT: pays the seller, transfers ownership, closes the listing. */
export async function buyNft({ listingId }: BuyNftInput): Promise<BuyNftResult> {
  const listing = marketplaceRepository.findById(listingId);
  if (!listing) throw new Error("Listing not found");
  const nft = nftsRepository.findById(listing.nftId);
  if (!nft) throw new Error("NFT not found");

  const buyer = usersRepository.currentUsername();
  const quote = quotePurchase(listing.price);
  if (!usersRepository.canAfford(buyer, quote.total)) throw new Error("Insufficient HIVE balance");

  const tx = await hiveService.transfer(
    buyer,
    listing.seller,
    quote.total,
    `Purchase · ${nft.name}`,
  );

  marketplaceRepository.remove(listingId);
  nftsRepository.update(nft.id, {
    owner: buyer,
    status: "Owned",
    estimatedValue: repriceAfterSale(nft, listing.price),
  });
  collectionsRepository.recordSale(nft.collectionId, listing.price);

  usersRepository.adjustBalance(buyer, -quote.total);
  usersRepository.adjustBalance(listing.seller, listing.price - quote.fee);

  activityRepository.addTransaction({
    txId: tx.txId,
    type: "sale",
    from: buyer,
    to: listing.seller,
    amount: quote.total,
    memo: `Marketplace purchase · ${nft.name}`,
  });
  activityRepository.add({
    type: "Sold",
    actor: buyer,
    target: listing.seller,
    nftId: nft.id,
    collectionId: nft.collectionId,
    label: `@${buyer} purchased ${nft.name}`,
    amount: listing.price,
    txId: tx.txId,
  });

  return { nftId: nft.id, txId: tx.txId, paid: quote.total };
}
