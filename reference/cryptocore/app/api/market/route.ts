import { jsonResponse } from "@/lib/api/cors";
import { findListedAssets } from "@/lib/modules/assets/repository.server";
import { findListedItems } from "@/lib/modules/items/repository.server";
import { findTemplateById } from "@/lib/modules/templates/repository.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const [listedAssets, listedItems] = await Promise.all([findListedAssets(), findListedItems()]);

    // Resolve template metadata for assets (name + image come from template)
    const assetListings = await Promise.all(
      listedAssets.map(async (asset) => {
        const tpl = await findTemplateById(asset.templateId);
        return {
          kind: "asset" as const,
          refId: asset.assetNumber,
          templateId: asset.templateId,
          owner: asset.owner,
          price: asset.market!.price,
          listedAt: asset.market!.listedAt,
          name: tpl?.name ?? `Asset #${asset.assetNumber}`,
          image: tpl?.image ?? "",
          slot: null,
          rarity: null,
          level: null,
          stats: null,
        };
      }),
    );

    const itemListings = listedItems.map((item) => ({
      kind: "item" as const,
      refId: item.itemNumber,
      templateId: item.templateId,
      owner: item.owner ?? "",
      price: item.market!.price,
      listedAt: item.market!.listedAt,
      name: item.name,
      slot: item.slot,
      rarity: item.rarity,
      level: item.level,
      stats: item.stats,
    }));

    const listings = [...assetListings, ...itemListings].sort((a, b) => b.listedAt - a.listedAt);

    return jsonResponse({ ok: true, listings }, request);
  } catch (err) {
    console.error("[market]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}
