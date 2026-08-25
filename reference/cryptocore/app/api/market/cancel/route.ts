import { authenticateRequest } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { cancelAssetListing, findAssetByNumber } from "@/lib/modules/assets/repository.server";
import { cancelItemListing, findItemByNumber } from "@/lib/modules/items/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import { findTemplateById } from "@/lib/modules/templates/repository.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const cancelInput = z.object({
  kind: z.enum(["asset", "item"]),
  refId: z.number().int().positive(),
});

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { kind, refId } = cancelInput.parse(body);

    // Resolve name before cancelling (doc still exists at this point)
    let name: string | undefined;
    let rarity: string | undefined;
    let slot: string | undefined;

    if (kind === "asset") {
      const asset = await findAssetByNumber(refId);
      const tpl = asset ? await findTemplateById(asset.templateId) : null;
      name = tpl?.name ?? `Asset #${refId}`;
    } else {
      const item = await findItemByNumber(refId);
      name = item?.name ?? `Item #${refId}`;
      rarity = item?.rarity;
      slot = item?.slot;
    }

    const result =
      kind === "asset"
        ? await cancelAssetListing(refId, auth.wallet)
        : await cancelItemListing(refId, auth.wallet);

    if (result.ok) {
      await createLog({
        type: kind === "asset" ? "market_asset" : "market_item",
        wallet: auth.wallet,
        data: { action: "cancelled", kind, refId, name, rarity, slot },
      });
    }
    return jsonResponse(result, request, { status: result.ok ? 200 : 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    console.error("[market/cancel]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "POST, OPTIONS" },
  });
}
