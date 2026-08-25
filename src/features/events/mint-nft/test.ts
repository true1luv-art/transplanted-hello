import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { collectionsRepository } from "@/features/mocks/data/collections/repository";
import { quoteMint } from "@/features/mocks/data/marketplace/model";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { mintNft } from "./action";

const openCollection = () =>
  appData
    .read()
    .collections.find(
      (c) => c.minted < c.maxSupply && c.creator !== usersRepository.currentUsername(),
    )!;

describe("mintNft", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("mints a token, debits the buyer and increments supply", async () => {
    const collection = openCollection();
    const buyer = usersRepository.currentUsername();
    usersRepository.setBalance(buyer, 5_000);
    const before = collection.minted;
    const quote = quoteMint(collection);

    const { nft } = await mintNft({ collectionId: collection.id });

    expect(nftsRepository.findById(nft.id)?.owner).toBe(buyer);
    expect(collectionsRepository.findById(collection.id)?.minted).toBe(before + 1);
    expect(usersRepository.balanceOf(buyer)).toBeCloseTo(5_000 - quote.total, 5);
  });

  it("queues concurrent mints into sequential mint numbers with chain token ids", async () => {
    const collection = openCollection();
    usersRepository.setBalance(usersRepository.currentUsername(), 50_000);
    const highestBefore = Math.max(0, ...nftsRepository.list().map((n) => n.tokenId ?? 0));

    const [first, second] = await Promise.all([
      mintNft({ collectionId: collection.id }),
      mintNft({ collectionId: collection.id }),
    ]);

    const numbers = [first.nft.NftMintedNumber, second.nft.NftMintedNumber];
    expect(numbers[1]).toBe((numbers[0] ?? 0) + 1);
    // Token ids come from the chain, not from the collection mint order.
    for (const result of [first, second]) {
      expect(result.nft.tokenId).toBeGreaterThan(highestBefore);
      expect(result.nft.tokenId).not.toBe(result.nft.NftMintedNumber);
    }
  });

  it("refuses to mint without enough balance", async () => {
    const collection = openCollection();
    usersRepository.setBalance(usersRepository.currentUsername(), 0);
    await expect(mintNft({ collectionId: collection.id })).rejects.toThrow(/Insufficient/);
  });
}, 20_000);
