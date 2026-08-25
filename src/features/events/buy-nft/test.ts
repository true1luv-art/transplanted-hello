import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { quotePurchase } from "@/features/mocks/data/marketplace/model";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { buyNft } from "./action";

describe("buyNft", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("transfers ownership, closes the listing and settles both sides", async () => {
    const listing = appData
      .read()
      .listings.find((l) => l.seller !== usersRepository.currentUsername())!;
    const buyer = usersRepository.currentUsername();
    usersRepository.setBalance(buyer, 10_000);
    const sellerBefore = usersRepository.balanceOf(listing.seller);
    const quote = quotePurchase(listing.price);

    const result = await buyNft({ listingId: listing.id });

    expect(result.paid).toBeCloseTo(quote.total, 5);
    expect(marketplaceRepository.findById(listing.id)).toBeUndefined();
    expect(nftsRepository.findById(listing.nftId)?.owner).toBe(buyer);
    expect(usersRepository.balanceOf(buyer)).toBeCloseTo(10_000 - quote.total, 5);
    expect(usersRepository.balanceOf(listing.seller)).toBeCloseTo(
      sellerBefore + listing.price - quote.fee,
      5,
    );
  });

  it("refuses a purchase the buyer cannot afford", async () => {
    const listing = appData.read().listings[0]!;
    usersRepository.setBalance(usersRepository.currentUsername(), 0);
    await expect(buyNft({ listingId: listing.id })).rejects.toThrow(/Insufficient/);
  });
});
