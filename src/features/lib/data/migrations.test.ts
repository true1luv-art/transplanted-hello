import { describe, expect, it } from "vitest";
import { DB_VERSION, migrateAppData, migrateV1ToV2 } from "@/features/lib/data/migrations";

const v1State = () => ({
  collections: [{ id: "col-1", name: "Otters", symbol: "OTTERS" }],
  nftAssets: [
    {
      id: "asset-1",
      collectionId: "col-1",
      NFTMintId: 1,
      NFTokenID: 12,
      name: "otters #1",
      description: "first",
      imageUri: "ipfs://img/1.png",
      metadataUri: "ipfs://meta/1.json",
      imageCid: "img-cid",
      attributes: [{ trait: "Body", value: "Blue" }],
      status: "uploaded",
    },
  ],
  nfts: [
    {
      id: "nft-1",
      collectionId: "col-1",
      tokenId: 7,
      name: "Prime Otter #7",
      description: "minted",
      image: "ipfs://img/7.png",
      attributes: [],
    },
  ],
  unminted: {
    "col-1": [
      {
        id: "pool-2",
        collectionId: "col-1",
        tokenId: 2,
        name: "otters #2",
        description: "second",
        image: "ipfs://img/2.png",
        metadataUri: "ipfs://meta/2.json",
        attributes: [{ trait: "Body", value: "Red" }],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
  balances: { alice: 100 },
});

describe("mock database migrations", () => {
  it("clears blockchain ids on unminted assets", () => {
    const next = migrateV1ToV2(v1State()) as Record<string, any>;
    expect(next["nftAssets"][0].NftMintedNumber).toBeNull();
    expect(next["nftAssets"][0].NFTokenID).toBeNull();
  });

  it("keeps blockchain ids on already-minted NFTs", () => {
    const next = migrateV1ToV2(v1State()) as Record<string, any>;
    expect(next["nfts"][0].NftMintedNumber).toBe(7);
  });

  it("converts legacy unminted pools into nft assets instead of dropping them", () => {
    const next = migrateV1ToV2(v1State()) as Record<string, any>;
    const migrated = next["nftAssets"].find((a: any) => a.NFTMintId === 2);
    expect(migrated).toBeDefined();
    expect(migrated.NftMintedNumber).toBeNull();
    expect(migrated.metadataUri).toBe("ipfs://meta/2.json");
    expect(next["unminted"]).toEqual({});
  });

  it("builds blockchain-shaped string properties", () => {
    const next = migrateV1ToV2(v1State()) as Record<string, any>;
    const props = next["nftAssets"][0].properties;
    expect(Object.keys(props).sort()).toEqual(["collection", "metadata", "symbol"]);
    expect(typeof props.metadata).toBe("string");
    expect(props.symbol).toBe("OTTERS");
    expect(props.metadata).toBe("ipfs://meta/1.json");
  });

  it("preserves unrelated data", () => {
    const next = migrateV1ToV2(v1State()) as Record<string, any>;
    expect(next["balances"]).toEqual({ alice: 100 });
    expect(next["collections"]).toHaveLength(1);
  });

  it("is a no-op once the payload is current", () => {
    const migrated = migrateAppData(v1State(), DB_VERSION) as Record<string, any>;
    expect(migrated["unminted"]).not.toEqual({});
  });
});
