import type { CancelListingInput } from "@/features/types/marketplace";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";

/** Removes a listing and returns the NFT to "Owned". */
export function cancelListing({ listingId }: CancelListingInput): void {
  const listing = marketplaceRepository.findById(listingId);
  if (!listing) return;

  const nft = nftsRepository.findById(listing.nftId);
  marketplaceRepository.remove(listingId);
  nftsRepository.update(listing.nftId, { status: "Owned" });

  activityRepository.add({
    type: "Delisted",
    actor: listing.seller,
    nftId: listing.nftId,
    collectionId: nft?.collectionId ?? "",
    label: `@${listing.seller} cancelled listing for ${nft?.name ?? "NFT"}`,
    amount: listing.price,
  });
}
