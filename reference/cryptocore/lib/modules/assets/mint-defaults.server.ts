import type { Types } from "mongoose";
import { incrementMintCount } from "@/lib/modules/templates/repository.server";
import { updatePlayer } from "@/lib/modules/players/repository.server";
import { createAsset, mintNextAssetNumber } from "./repository.server";
import type { AssetKind } from "./types.server";

/**
 * Auto-mints the three soulbound default cosmetics (templateIds 0, 100, 200)
 * for a newly registered player.
 *
 * Called fire-and-forget on first login — errors are logged but do not block
 * the registration response.
 */
export async function mintSoulboundDefaults(wallet: string): Promise<void> {
  const defaults: { templateId: number; kind: AssetKind }[] = [
    { templateId: 0, kind: "avatar" },
    { templateId: 100, kind: "banner" },
    { templateId: 200, kind: "background" },
  ];

  const profile: Record<AssetKind, Types.ObjectId | null> = {
    avatar: null,
    banner: null,
    background: null,
  };

  await Promise.all(
    defaults.map(async ({ templateId, kind }) => {
      try {
        const [mintResult, assetNumber] = await Promise.all([
          incrementMintCount(templateId),
          mintNextAssetNumber(),
        ]);

        if (!mintResult.ok) {
          console.error(
            `[mintSoulboundDefaults] template ${templateId} increment failed: ${mintResult.error}`,
          );
          return;
        }

        const asset = await createAsset({
          assetNumber,
          templateId,
          kind,
          owner: wallet,
          soulbound: true,
          mintNumber: mintResult.mintNumber,
          equipped: true,
          createdAt: Date.now(),
          lastTransfer: 0,
        });

        profile[kind] = asset._id as Types.ObjectId;
      } catch (err) {
        console.error(`[mintSoulboundDefaults] failed for templateId=${templateId}:`, err);
      }
    }),
  );

  // Point the player's profile at the freshly minted soulbound cosmetics.
  try {
    await updatePlayer(wallet, { profile });
  } catch (err) {
    console.error(`[mintSoulboundDefaults] failed to write profile for ${wallet}:`, err);
  }
}
