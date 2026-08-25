import { describe, expect, it } from "vitest";

import { normalizeNftAttributes } from "./ipfs-metadata";

describe("IPFS NFT metadata attributes", () => {
  it("keeps canonical trait_type attributes and stringifies values", () => {
    expect(
      normalizeNftAttributes([
        { trait_type: "Background", value: "Ocean Dream" },
        { trait_type: "Level", value: 3 },
      ]),
    ).toEqual([
      { trait_type: "Background", value: "Ocean Dream" },
      { trait_type: "Level", value: "3" },
    ]);
  });

  it("ignores invalid entries", () => {
    expect(
      normalizeNftAttributes([
        { trait_type: "Eyes", value: "Cool Glasses" },
        { trait_type: "", value: "missing name" },
        { trait_type: "Mouth" },
      ]),
    ).toEqual([{ trait_type: "Eyes", value: "Cool Glasses" }]);
  });
});