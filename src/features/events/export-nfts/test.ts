import { describe, expect, it } from "vitest";

import type { GeneratorContext, GeneratorSnapshot } from "@/features/types/generation";
import { emptyGeneratorData, type GeneratorData } from "@/features/lib/data/generator-data";
import { generateCollection } from "@/features/lib/generator/engine";
import { createSampleProject } from "@/features/lib/generator/sample";
import { exportNfts } from "./action";

function harness() {
  const sample = createSampleProject();
  const settings = { ...sample.settings, supply: 4 };
  const result = generateCollection({ project: { settings, layers: sample.layers } });
  const images = new Map(result.nfts.map((nft) => [nft.tokenId, new Uint8Array([1, 2, 3])]));

  let state: GeneratorData = { ...emptyGeneratorData(), settings, layers: sample.layers, result };
  const ctx: GeneratorContext = {
    get: (): GeneratorSnapshot => state,
    set: (patch) => {
      state = { ...state, ...patch } as GeneratorData;
    },
    artwork: { images, track: () => {}, release: () => {} },
  };
  return { ctx, read: () => state };
}

describe("exportNfts", () => {
  it("builds an export package for the generated result", async () => {
    const { ctx, read } = harness();
    await exportNfts(ctx);

    expect(read().error).toBeNull();
    expect(read().exportPackage).toBeTruthy();
    expect(read().progress.phase).toBe("ready");
  });

  it("does nothing when there is no result yet", async () => {
    const { ctx, read } = harness();
    ctx.set({ result: null });
    await exportNfts(ctx);

    expect(read().exportPackage).toBeNull();
  });
});
