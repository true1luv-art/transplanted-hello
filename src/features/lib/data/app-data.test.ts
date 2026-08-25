import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData, createInitialData, MOCK_DB_PREFIX } from "./app-data";
import { buildNftAsset } from "@/features/mocks/data/nft-assets/model";
import { nftAssetsRepository } from "@/features/mocks/data/nft-assets/repository";

describe("mock database (LocalStorage driver)", () => {
  beforeEach(() => appData.patch(createInitialData()));

  it("initializes with EMPTY collections — no fake dataset", () => {
    const state = appData.read();
    expect(state.collections).toEqual([]);
    expect(state.nftAssets).toEqual([]);
    expect(state.nfts).toEqual([]);
    expect(state.listings).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.activities).toEqual([]);
  });

  it("uses a dedicated namespace prefix for its storage keys", () => {
    expect(MOCK_DB_PREFIX).toBe("hivex.mockdb.");
  });

  it("stores and reads NFT assets through the repository only", () => {
    const asset = nftAssetsRepository.insert(
      buildNftAsset({
        collectionId: "col_1",
        NFTMintId: 1,
        name: "Otter #1",
        description: "d",
        filename: "1.png",
        mimeType: "image/png",
        size: 3,
        attributes: [{ trait: "Background", value: "Blue" }],
      }),
    );

    expect(nftAssetsRepository.listByCollection("col_1")).toHaveLength(1);
    nftAssetsRepository.patch(asset.id, { status: "uploaded", imageUri: "ipfs://abc" });
    expect(nftAssetsRepository.findById(asset.id)?.status).toBe("uploaded");
    nftAssetsRepository.removeByCollection("col_1");
    expect(nftAssetsRepository.list()).toHaveLength(0);
  });

  it("resets back to an empty database", () => {
    appData.patch(createDemoData());
    expect(appData.read().collections.length).toBeGreaterThan(0);
    appData.clear();
    expect(appData.read().collections).toEqual([]);
    expect(appData.read().nftAssets).toEqual([]);
  });
});
