import { avatarTemplates } from "@/features/templates/avatars";
import { bannerTemplates } from "@/features/templates/banners";
import { backgroundTemplates } from "@/features/templates/backgrounds";
import type { AssetKind } from "@/lib/modules/assets/types.server";
import {
  createAsset,
  hasAssetWithTemplate,
  mintNextAssetNumber,
} from "@/lib/modules/assets/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import {
  creditHash,
  debitHash,
  findPlayerByWallet,
  incrementPlayer,
} from "@/lib/modules/players/repository.server";
import { incrementMintCount } from "@/lib/modules/templates/repository.server";

// Same 5% referral cut as chest purchases (see REFERRAL_CUT in
// chest.server.ts) — cosmetics are also an in-game purchase, so a referred
// player's cosmetic buys should pay their referrer just like chest buys do.
const REFERRAL_CUT = 0.05;

type CosmeticTemplate = {
  templateId: number;
  name: string;
  type: AssetKind;
  price: number;
  soulbound: boolean;
  maxSupply: number | null;
};

function findCosmeticTemplate(templateId: number): CosmeticTemplate | undefined {
  const avatar = avatarTemplates.find((t) => t.templateId === templateId);
  if (avatar) return { ...avatar, type: "avatar" as AssetKind };
  const banner = bannerTemplates.find((t) => t.templateId === templateId);
  if (banner) return { ...banner, type: "banner" as AssetKind };
  const bg = backgroundTemplates.find((t) => t.templateId === templateId);
  if (bg) return { ...bg, type: "background" as AssetKind };
  return undefined;
}

/**
 * Atomically mints a purchasable cosmetic for a player.
 *
 * Flow:
 *   1. Validate: template exists, is not soulbound, has a price > 0
 *   2. Debit HASH — fails fast if the player cannot afford it
 *   3. incrementMintCount — enforces supply cap atomically
 *   4. On sold-out race condition: refund HASH and return error
 *   5. createAsset — record the NFT in the database
 *   6. createLog — audit trail
 */
export async function mintCosmetic(
  wallet: string,
  templateId: number,
): Promise<{ ok: boolean; error?: string }> {
  const tpl = findCosmeticTemplate(templateId);
  if (!tpl) return { ok: false, error: "Unknown template" };
  if (tpl.soulbound || tpl.price <= 0) return { ok: false, error: "This cosmetic is not for sale" };

  // Players may only own one mint of a given template — block a repeat
  // purchase before any HASH changes hands.
  if (await hasAssetWithTemplate(wallet, templateId)) {
    return { ok: false, error: "You already own this cosmetic" };
  }

  // Look up the buyer before any HASH moves, so we know who (if anyone)
  // should receive the referral cut once the purchase succeeds.
  const player = await findPlayerByWallet(wallet);
  if (!player) return { ok: false, error: "Player not found" };

  // 1. Debit HASH upfront
  const debit = await debitHash(wallet, tpl.price);
  if (!debit.ok) return { ok: false, error: "Not enough HASH" };

  // 2. Atomically claim an edition slot
  const mintResult = await incrementMintCount(templateId);
  if (!mintResult.ok) {
    // Race-condition sold out — refund
    await creditHash(wallet, tpl.price);
    return { ok: false, error: "Sold out" };
  }

  // 3. Mint the asset
  const assetNumber = await mintNextAssetNumber();
  await createAsset({
    assetNumber,
    templateId,
    kind: tpl.type,
    owner: wallet,
    soulbound: false,
    mintNumber: mintResult.mintNumber,
    equipped: false,
    createdAt: Date.now(),
    lastTransfer: 0,
  });

  // 4. Audit log
  await createLog({
    type: "shop",
    wallet,
    amount: -tpl.price,
    data: {
      templateId,
      kind: tpl.type,
      name: tpl.name,
      mintNumber: mintResult.mintNumber,
    },
  });

  // 5. Fire referral cut if this player was referred by someone — paid on
  // top of the purchase price, same as the chest-purchase referral cut.
  if (player.referredBy) {
    const cut = Math.floor(tpl.price * REFERRAL_CUT);
    if (cut > 0) {
      await Promise.all([
        creditHash(player.referredBy, cut),
        incrementPlayer(player.referredBy, { referralEarned: cut }),
        createLog({
          type: "referral",
          wallet: player.referredBy,
          target: wallet,
          amount: cut,
          data: { templateId, kind: tpl.type, name: tpl.name, cosmeticPrice: tpl.price },
        }),
      ]);
    }
  }

  return { ok: true };
}
