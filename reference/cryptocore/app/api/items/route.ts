import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { toEpoch } from "@/lib/api/dto";
import { findItemsByOwner } from "@/lib/modules/items/repository.server";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const items = await findItemsByOwner(auth.wallet);
    return jsonResponse({ ok: true, items: items.map(toItemDto) }, request);
  } catch (err) {
    console.error("[items]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
