import { describe, expect, it, vi } from "vitest";

import type { GeneratorContext, GeneratorSnapshot } from "@/features/types/generation";
import { emptyGeneratorData, type GeneratorData } from "@/features/lib/data/generator-data";
import { activeLayers, generateCollection } from "@/features/lib/generator/engine";
import { createSampleProject } from "@/features/lib/generator/sample";
import { replaceNftTrait } from "./action";

vi.mock("@/features/lib/generator/compose", () => ({
  composeNFT: async () => ({ bytes: new Uint8Array([1]), url: "", thumbnailUrl: "" }),
}));

function harness() {
  const sample = createSampleProject();
  const settings = { ...sample.settings, supply: 5 };
  const result = generateCollection({ project: { settings, layers: sample.layers } });

  let state: GeneratorData = { ...emptyGeneratorData(), settings, layers: sample.layers, result };
  const ctx: GeneratorContext = {
    get: (): GeneratorSnapshot => state,
    set: (patch) => {
      state = { ...state, ...patch } as GeneratorData;
    },
    artwork: { images: new Map(), track: () => {}, release: () => {} },
  };
  return { ctx, read: () => state, layers: sample.layers };
}

describe("replaceNftTrait", () => {
  it("swaps the trait, recomputes the DNA and invalidates the export", async () => {
    const { ctx, read, layers } = harness();
    const nft = read().result!.nfts[0]!;
    const layer = activeLayers(layers).find((l) => l.traits.length > 1)!;
    const current = nft.traits.find((t) => t.layerId === layer.id)!;
    const next = layer.traits.find((t) => t.id !== current.traitId)!;
    ctx.set({ exportPackage: {} as never });

    await replaceNftTrait({ tokenId: nft.tokenId, layerId: layer.id, traitId: next.id }, ctx);

    const updated = read().result!.nfts.find((n) => n.tokenId === nft.tokenId)!;
    expect(updated.traits.find((t) => t.layerId === layer.id)?.traitId).toBe(next.id);
    expect(updated.dna).not.toBe(nft.dna);
    expect(read().exportPackage).toBeNull();
  });

  it("ignores an unknown trait", async () => {
    const { ctx, read, layers } = harness();
    const nft = read().result!.nfts[0]!;
    await replaceNftTrait({ tokenId: nft.tokenId, layerId: layers[0]!.id, traitId: "nope" }, ctx);

    expect(read().result!.nfts[0]!.dna).toBe(nft.dna);
  });
});
