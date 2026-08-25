import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { cancelListing } from "./action";

describe("cancelListing", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("removes the listing and returns the NFT to Owned", () => {
    const listing = appData.read().listings[0]!;
    cancelListing({ listingId: listing.id });

    expect(marketplaceRepository.findById(listing.id)).toBeUndefined();
    expect(nftsRepository.findById(listing.nftId)?.status).toBe("Owned");
    expect(appData.read().activities[0]?.type).toBe("Delisted");
  });

  it("is a no-op for an unknown listing", () => {
    const before = appData.read().listings.length;
    cancelListing({ listingId: "missing" });
    expect(appData.read().listings.length).toBe(before);
  });
});
