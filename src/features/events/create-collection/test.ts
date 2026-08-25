import { beforeEach, describe, expect, it } from "vitest";

import { COLLECTION_CREATION_FEE } from "@/features/types/constants";
import { appData, createDemoData } from "@/features/lib/data/app-data";
import { collectionsRepository } from "@/features/mocks/data/collections/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { createCollection } from "./action";

const input = {
  name: "Test Bees",
  symbol: "TSTBEE",
  description: "Unit test collection",
  maxSupply: 10,
  mintPrice: 1,
  royalty: 5,
  category: "Art",
  creatorFee: 5,
  platformFee: 5,
  metadataBaseUri: "ipfs://test/",
};

describe("createCollection", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("stores the collection and charges the deployment fee", async () => {
    const creator = usersRepository.currentUsername();
    usersRepository.setBalance(creator, 100);

    const collection = await createCollection(input);

    expect(collectionsRepository.findById(collection.id)?.name).toBe("Test Bees");
    expect(usersRepository.balanceOf(creator)).toBeCloseTo(100 - COLLECTION_CREATION_FEE, 5);
    expect(appData.read().activities[0]?.type).toBe("Collection Created");
  });

  it("rejects deployment when the creator cannot afford the fee", async () => {
    usersRepository.setBalance(usersRepository.currentUsername(), 1);
    await expect(createCollection(input)).rejects.toThrow(/Insufficient/);
    expect(appData.read().collections.some((c) => c.symbol === "TSTBEE")).toBe(false);
  });
});
