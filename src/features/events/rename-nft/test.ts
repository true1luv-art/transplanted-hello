import { describe, expect, it } from "vitest";

import type { GeneratorContext, GeneratorPatch } from "@/features/types/generation";
import type { GenerationResult } from "@/features/lib/generator/types";
import { renameNft } from "./action";

const result = {
  nfts: [
    { tokenId: 1, name: "Item #1", dna: "a", traits: [] },
    { tokenId: 2, name: "Item #2", dna: "b", traits: [] },
  ],
  generated: 2,
  unique: 2,
  distribution: [],
} as unknown as GenerationResult;

function context(initial: GenerationResult | null) {
  const patches: GeneratorPatch[] = [];
  let current = initial;
  const ctx: GeneratorContext = {
    get: () => ({ settings: {} as never, layers: [], result: current }),
    set: (patch) => {
      patches.push(patch);
      if (patch.result !== undefined) current = patch.result;
    },
    artwork: { images: new Map(), track: () => {}, release: () => {} },
  };
  return { ctx, patches, read: () => current };
}

describe("renameNft", () => {
  it("renames the target token and invalidates the export package", () => {
    const { ctx, patches, read } = context(result);

    renameNft({ tokenId: 2, name: "Queen Bee" }, ctx);

    expect(read()?.nfts.map((nft) => nft.name)).toEqual(["Item #1", "Queen Bee"]);
    expect(patches[0]?.exportPackage).toBeNull();
  });

  it("ignores renames without a generation result or matching token", () => {
    const empty = context(null);
    renameNft({ tokenId: 1, name: "x" }, empty.ctx);
    expect(empty.patches).toHaveLength(0);

    const present = context(result);
    renameNft({ tokenId: 99, name: "x" }, present.ctx);
    expect(present.patches).toHaveLength(0);
  });
});
