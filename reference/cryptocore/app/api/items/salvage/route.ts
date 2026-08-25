import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { toEpoch } from "@/lib/api/dto";
import { salvageItem, findItemsByOwner } from "@/lib/modules/items/repository.server";
import { creditSparks, updatePlayer } from "@/lib/modules/players/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import { salvageValue } from "@/features/game/items";
import { XP_PER_SPARK } from "@/features/game/level";
import { z } from "zod";

export const dynamic = "force-dynamic";

const itemInput = z.object({ itemNumber: z.number().int().positive() });

function toItemDto(item: Awaited<ReturnType<typeof findItemsByOwner>>[number]) {
  return {
    itemNumber: item.itemNumber,
    templateId: item.templateId,
    mintNumber: item.mintNumber,
    owner: item.owner,
    name: item.name,
    slot: item.slot,
    rarity: item.rarity,
    level: item.level,
    stats: item.stats,
    equipped: item.equipped,
    salvaged: item.salvaged,
    market: item.market ?? null,
    createdAt: toEpoch(item.createdAt),
    lastTransfer: item.lastTransfer,
  };
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { itemNumber } = itemInput.parse(body);
    const result = await salvageItem(itemNumber, auth.wallet);

    if (result.ok && result.item) {
      const sparks = salvageValue({
        level: result.item.level,
        stats: result.item.stats as never,
      });
      // The item repository only marks the item salvaged/unowned — it never
      // touches the player's balance, so the SPARKS payout has to happen
      // here or salvaging silently destroys the item for nothing.
      await creditSparks(auth.wallet, sparks);

      // Burning (salvaging) an item is one of the two gear sinks that grant
      // XP — award it in proportion to the SPARKS the salvage paid out.
      const xpGain = Math.round(sparks * XP_PER_SPARK);
      if (xpGain > 0) {
        await updatePlayer(auth.wallet, { $inc: { xp: xpGain } });
      }

      await createLog({
        type: "salvage",
        wallet: auth.wallet,
        amount: sparks,
        data: {
          itemNumber: result.item.itemNumber,
          name: result.item.name,
          rarity: result.item.rarity,
          slot: result.item.slot,
          level: result.item.level,
          sparks,
        },
      });
    }

    return jsonResponse(
      { ...result, item: result.item ? toItemDto(result.item) : undefined },
      request,
      { status: result.ok ? 200 : 400 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }

    console.error("[items/salvage]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
