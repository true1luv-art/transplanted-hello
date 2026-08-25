import { describe, expect, it } from "vitest";

import { appData, createInitialData } from "@/features/lib/data/app-data";
import { buildNftAsset } from "@/features/mocks/data/nft-assets/model";
import { nftAssetsRepository } from "@/features/mocks/data/nft-assets/repository";
import { buildCollectionMetadata, buildNftMetadata, indexVirtualCollection } from "./metadata";

describe("collection metadata", () => {
  const meta = buildCollectionMetadata({
    name: "Ember Sentinels",
    symbol: "EMBER",
    description: "d",
    imageUri: "ipfs://cid",
    maxSupply: 25,
    mintPrice: 5,
    creator: "alice",
  });

  it("is flat — no properties nesting and no chain field", () => {
    expect(meta).toEqual({
      name: "Ember Sentinels",
      symbol: "EMBER",
      description: "d",
      image: "ipfs://cid",
      maxSupply: 25,
      mintPrice: 5,
      currency: "HIVE",
      creator: "alice",
    });
    expect(meta).not.toHaveProperty("properties");
    expect(meta).not.toHaveProperty("chain");
  });
});

describe("NFT metadata", () => {
  const meta = buildNftMetadata({
    collectionName: "Ember Sentinels",
    collectionSymbol: "EMBER",
    NFTMintId: 23,
    description: "d",
    imageUri: "ipfs://cid",
    attributes: [{ trait: "Background", value: "Blue" }],
  });

  it("names the token from its virtual mint number", () => {
    expect(meta.name).toBe("Ember Sentinels #23");
    expect(meta.NFTMintId).toBe(23);
  });

  it("leaves NFTokenID null until the token is minted on Hive", () => {
    expect(meta.NFTokenID).toBeNull();
    const minted = buildNftMetadata({
      collectionName: "Ember Sentinels",
      collectionSymbol: "EMBER",
      NFTMintId: 23,
      NFTokenID: 908123,
      description: "d",
      imageUri: "ipfs://cid",
    });
    expect(minted.NFTokenID).toBe(908123);
    expect(minted.NFTMintId).toBe(23);
  });

  it("carries virtual-collection indexing fields and drops legacy keys", () => {
    expect(meta.collection).toBe("Ember Sentinels");
    expect(meta.symbol).toBe("EMBER");
    expect(meta).not.toHaveProperty("properties");
    expect(meta).not.toHaveProperty("tokenNumber");
  });

  it("indexes a token back into its virtual collection", () => {
    expect(indexVirtualCollection({ ...meta })).toEqual({
      collection: "Ember Sentinels",
      symbol: "EMBER",
      NFTMintId: 23,
      NFTokenID: null,
    });
    expect(indexVirtualCollection({ name: "x" })).toBeNull();
  });
});

describe("prepared assets (nft-assets)", () => {
  const makeAsset = (NFTMintId: number) =>
    buildNftAsset({
      collectionId: "col_1",
      NFTMintId,
      name: `Ember Sentinels #${NFTMintId}`,
      description: "d",
      filename: `${NFTMintId}.png`,
      mimeType: "image/png",
      size: 1,
      attributes: [],
    });

  it("assigns NFTMintId immediately and keeps NFTokenID null", () => {
    appData.patch(createInitialData());
    nftAssetsRepository.insertMany([1, 2, 3].map(makeAsset));
    const assets = nftAssetsRepository.listByCollection("col_1");

    expect(assets.map((a) => a.NFTMintId)).toEqual([1, 2, 3]);
    expect(assets.every((a) => a.NFTokenID === null)).toBe(true);
  });

  it("preserves uploaded image and metadata CIDs", () => {
    const asset = buildNftAsset({
      collectionId: "col_1",
      NFTMintId: 1,
      name: "Ember Sentinels #1",
      description: "d",
      filename: "1.png",
      mimeType: "image/png",
      size: 1,
      attributes: [],
      imageCid: "image-root-cid",
      metadataCid: "metadata-root-cid",
      imageRootCid: "image-root-cid",
      metadataRootCid: "metadata-root-cid",
      imageUri: "ipfs://image-root-cid/1.png",
      metadataUri: "ipfs://metadata-root-cid/1.json",
      status: "uploaded",
    });

    expect(asset).toMatchObject({
      cid: "image-root-cid",
      imageCid: "image-root-cid",
      metadataCid: "metadata-root-cid",
      imageUri: "ipfs://image-root-cid/1.png",
      metadataUri: "ipfs://metadata-root-cid/1.json",
      status: "uploaded",
    });
  });

  it("keeps NFTMintId unique inside a virtual collection", () => {
    appData.patch(createInitialData());
    nftAssetsRepository.insertMany([1, 2, 3].map(makeAsset));
    const ids = nftAssetsRepository.listByCollection("col_1").map((a) => a.NFTMintId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("allows the same NFTMintId in a different virtual collection", () => {
    appData.patch(createInitialData());
    nftAssetsRepository.insert(makeAsset(1));
    nftAssetsRepository.insert({ ...makeAsset(1), collectionId: "col_2" });
    expect(nftAssetsRepository.listByCollection("col_1")).toHaveLength(1);
    expect(nftAssetsRepository.listByCollection("col_2")).toHaveLength(1);
  });
});
