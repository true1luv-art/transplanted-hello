import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GeneratorContext, GeneratorSnapshot } from "@/features/types/generation";
import { emptyGeneratorData, type GeneratorData } from "@/features/lib/data/generator-data";
import { createSampleProject } from "@/features/lib/generator/sample";
import { generateNfts } from "./action";

vi.mock("@/features/lib/generator/compose", () => ({
  composeAll: async (nfts: { tokenId: number }[]) =>
    new Map(
      nfts.map((nft) => [nft.tokenId, { bytes: new Uint8Array([1]), url: "", thumbnailUrl: "" }]),
    ),
}));

function harness(supply: number) {
  const sample = createSampleProject();
  let state: GeneratorData = {
    ...emptyGeneratorData(),
    settings: { ...sample.settings, supply },
    layers: sample.layers,
  };
  const ctx: GeneratorContext = {
    get: (): GeneratorSnapshot => state,
    set: (patch) => {
      state = { ...state, ...patch } as GeneratorData;
    },
    artwork: { images: new Map(), track: () => {}, release: () => {} },
  };
  return { ctx, read: () => state };
}

describe("generateNfts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("produces the requested supply and moves to the preview step", async () => {
    const { ctx, read } = harness(6);
    await generateNfts(ctx);

    expect(read().error).toBeNull();
    expect(read().result?.nfts).toHaveLength(6);
    expect(read().step).toBe("preview");
    expect(read().progress.phase).toBe("ready");
  });

  it("reports an error when the supply exceeds the possible combinations", async () => {
    const { ctx, read } = harness(1_000_000);
    await generateNfts(ctx);

    expect(read().error).toBeTruthy();
    expect(read().result).toBeNull();
  });
});
