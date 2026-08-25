import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { listNft } from "./action";

const ownedNft = () =>
  appData
    .read()
    .nfts.find((n) => n.owner === usersRepository.currentUsername() && n.status === "Owned")!;

describe("listNft", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("creates a listing and flags the NFT as listed", async () => {
    const nft = ownedNft();
    const listing = await listNft({ nftId: nft.id, price: 42 });

    expect(marketplaceRepository.findById(listing.id)?.price).toBe(42);
    expect(nftsRepository.findById(nft.id)?.status).toBe("Listed");
    expect(appData.read().activities[0]?.type).toBe("Listed");
  });

  it("throws for an unknown NFT", async () => {
    await expect(listNft({ nftId: "nope", price: 1 })).rejects.toThrow(/NFT not found/);
  });
});
