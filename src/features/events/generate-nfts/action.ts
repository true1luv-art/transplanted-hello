import { IDLE_PROGRESS, type GeneratorContext } from "@/features/types/generation";
import { composeAll } from "@/features/lib/generator/compose";
import { GenerationError, generateCollection } from "@/features/lib/generator/engine";

/**
 * Runs a full studio generation: rolls the DNA set, composites the artwork and
 * moves the studio to the preview step.
 */
export async function generateNfts(ctx: GeneratorContext): Promise<void> {
  const { settings, layers } = ctx.get();
  ctx.artwork.release();
  ctx.set({
    error: null,
    exportPackage: null,
    result: null,
    selectedTokenId: null,
    editLayerId: null,
    filters: {},
    progress: { phase: "generating", done: 0, total: settings.supply, label: "Generating NFTs" },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  try {
    const result = generateCollection({
      project: { settings, layers },
      onProgress: (done, total) =>
        ctx.set({ progress: { phase: "generating", done, total, label: "Generating NFTs" } }),
    });

    ctx.set({
      progress: {
        phase: "composing",
        done: 0,
        total: result.nfts.length,
        label: "Rendering artwork",
      },
    });
    const composed = await composeAll(
      result.nfts,
      layers,
      { width: settings.width, height: settings.height },
      (done, total) =>
        ctx.set({ progress: { phase: "composing", done, total, label: "Rendering artwork" } }),
    );

    const nfts = result.nfts.map((nft) => {
      const image = composed.get(nft.tokenId);
      ctx.artwork.track(image?.url, image?.thumbnailUrl);
      return { ...nft, previewUrl: image?.url, thumbnailUrl: image?.thumbnailUrl };
    });
    for (const [tokenId, image] of composed) ctx.artwork.images.set(tokenId, image.bytes);

    ctx.set({
      result: { ...result, nfts },
      selectedTokenId: nfts[0]?.tokenId ?? null,
      editLayerId: null,
      step: "preview",
      progress: {
        phase: "ready",
        done: nfts.length,
        total: nfts.length,
        label: "Generation complete",
      },
    });
  } catch (error) {
    const message =
      error instanceof GenerationError || error instanceof Error
        ? error.message
        : "Generation failed";
    ctx.set({ error: message, progress: IDLE_PROGRESS });
  }
}
