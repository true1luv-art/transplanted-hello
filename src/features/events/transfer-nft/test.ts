import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { transferNft } from "./action";

describe("transferNft", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("moves the NFT to the recipient and clears any listing", async () => {
    const nft = appData.read().nfts.find((n) => n.owner === usersRepository.currentUsername())!;
    await transferNft({ nftId: nft.id, to: "bob" });

    expect(nftsRepository.findById(nft.id)?.owner).toBe("bob");
    expect(appData.read().listings.some((l) => l.nftId === nft.id)).toBe(false);
    expect(appData.read().activities[0]?.type).toBe("Transferred");
  });

  it("throws for an unknown NFT", async () => {
    await expect(transferNft({ nftId: "nope", to: "bob" })).rejects.toThrow(/NFT not found/);
  });
});
