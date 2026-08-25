import { describe, expect, it } from "vitest";

import { normalizeNftAttributes } from "./ipfs-metadata";

describe("IPFS NFT metadata attributes", () => {
  it("normalizes OpenSea trait_type attributes", () => {
    expect(
      normalizeNftAttributes([
        { trait_type: "Background", value: "Ocean Dream" },
        { trait_type: "Level", value: 3 },
      ]),
    ).toEqual([
      { trait: "Background", value: "Ocean Dream" },
      { trait: "Level", value: 3 },
    ]);
  });

  it("keeps app-shaped attributes and ignores invalid entries", () => {
    expect(
      normalizeNftAttributes([
        { trait: "Eyes", value: "Cool Glasses" },
        { trait_type: "", value: "missing name" },
        { trait_type: "Mouth" },
      ]),
    ).toEqual([{ trait: "Eyes", value: "Cool Glasses" }]);
  });
});