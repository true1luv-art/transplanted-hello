import type { GeneratorContext, ReplaceNftTraitInput } from "@/features/types/generation";
import { composeNFT } from "@/features/lib/generator/compose";
import { activeLayers, dnaOf, traitDistribution } from "@/features/lib/generator/engine";
import type {
  GeneratedNFT,
  GenerationResult,
  GeneratorLayer,
} from "@/features/lib/generator/types";
import { normalizedProbabilities } from "@/features/lib/traits/weighted-random";

/** Recomputes the trait distribution (counts only) after a manual edit. */
export function rescore(
  layers: GeneratorLayer[],
  nfts: GeneratedNFT[],
  previous: GenerationResult,
): GenerationResult {
  return {
    ...previous,
    nfts,
    generated: nfts.length,
    unique: new Set(nfts.map((nft) => nft.dna)).size,
    distribution: traitDistribution(layers, nfts),
  };
}

/** Swaps one trait on one generated token and re-composites its artwork. */
export async function replaceNftTrait(
  { tokenId, layerId, traitId }: ReplaceNftTraitInput,
  ctx: GeneratorContext,
): Promise<void> {
  const { result, layers, settings } = ctx.get();
  if (!result) return;

  const layer = activeLayers(layers).find((candidate) => candidate.id === layerId);
  const trait = layer?.traits.find((candidate) => candidate.id === traitId);
  if (!layer || !trait) return;

  const probabilities = normalizedProbabilities(layer.traits);
  const target = result.nfts.find((nft) => nft.tokenId === tokenId);
  if (!target) return;

  const traits = target.traits.map((ref) =>
    ref.layerId === layerId
      ? {
          ...ref,
          traitId: trait.id,
          traitName: trait.name,
          weight: trait.weight,
          probability: probabilities.get(trait.id) ?? 0,
        }
      : ref,
  );

  const updated: GeneratedNFT = { ...target, traits, dna: dnaOf(traits) };

  try {
    const image = await composeNFT(updated, layers, {
      width: settings.width,
      height: settings.height,
    });
    ctx.artwork.images.set(tokenId, image.bytes);
    ctx.artwork.track(image.url, image.thumbnailUrl);
    updated.previewUrl = image.url;
    updated.thumbnailUrl = image.thumbnailUrl;
  } catch {
    /* keep the previous preview if compositing fails */
  }

  const current = ctx.get().result;
  if (!current) return;
  const nfts = current.nfts.map((nft) => (nft.tokenId === tokenId ? updated : nft));
  ctx.set({ result: rescore(layers, nfts, current), exportPackage: null });
}
