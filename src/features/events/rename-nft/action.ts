import type { GeneratorContext, RenameNftInput } from "@/features/types/generation";

/**
 * Renames one generated token. The export package is invalidated because its
 * metadata no longer matches the collection.
 */
export function renameNft({ tokenId, name }: RenameNftInput, ctx: GeneratorContext): void {
  const { result } = ctx.get();
  if (!result) return;
  if (!result.nfts.some((nft) => nft.tokenId === tokenId)) return;

  ctx.set({
    result: {
      ...result,
      nfts: result.nfts.map((nft) => (nft.tokenId === tokenId ? { ...nft, name } : nft)),
    },
    exportPackage: null,
  });
}
