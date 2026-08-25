import type { Types } from "mongoose";
import { AssetModel } from "./model.server";
import type { IAsset, AssetInput, AssetKind } from "./types.server";
import { connectDatabase } from "@/lib/config/database";
import { nextCounter } from "@/lib/modules/game-stats/repository.server";

export async function findAssetsByOwner(wallet: string): Promise<IAsset[]> {
  await connectDatabase();
  return AssetModel.find({ owner: wallet }).sort({ createdAt: 1 }).lean<IAsset[]>();
}

/** Bulk lookup by MongoDB _id — used to resolve equipped cosmetic references. */
export async function findAssetsByIds(ids: Types.ObjectId[]): Promise<IAsset[]> {
  await connectDatabase();
  if (ids.length === 0) return [];
  return AssetModel.find({ _id: { $in: ids } }).lean<IAsset[]>();
}

export async function findAssetByNumber(assetNumber: number): Promise<IAsset | null> {
  await connectDatabase();
  return AssetModel.findOne({ assetNumber }).lean<IAsset>();
}

/**
 * Whether the wallet already owns any asset (mint) of this template —
 * used to cap cosmetic ownership at one per template, whether acquired via
 * the shop or the marketplace.
 */
export async function hasAssetWithTemplate(wallet: string, templateId: number): Promise<boolean> {
  await connectDatabase();
  const existing = await AssetModel.exists({ owner: wallet, templateId });
  return Boolean(existing);
}

export async function findEquippedAssetByKind(
  wallet: string,
  kind: AssetKind,
): Promise<IAsset | null> {
  await connectDatabase();
  return AssetModel.findOne({ owner: wallet, kind, equipped: true }).lean<IAsset>();
}

export async function mintNextAssetNumber(): Promise<number> {
  return nextCounter("assetNumber");
}

export async function createAsset(input: AssetInput): Promise<IAsset> {
  await connectDatabase();
  return AssetModel.create(input);
}

/**
 * Equips an asset. Unequips any other asset of the same kind first.
 * Rejects if the asset doesn't belong to the caller.
 */
export async function equipAsset(
  assetNumber: number,
  owner: string,
): Promise<{ ok: boolean; asset?: IAsset; error?: string }> {
  await connectDatabase();
  const asset = await AssetModel.findOne({ assetNumber, owner });
  if (!asset) return { ok: false, error: "Asset not found or wrong owner" };

  // Unequip existing asset of same kind
  await AssetModel.updateMany(
    { owner, kind: asset.kind, equipped: true },
    { $set: { equipped: false } },
  );

  asset.equipped = true;
  await asset.save();
  return { ok: true, asset: asset.toObject() };
}

/**
 * Unequips an asset.
 */
export async function unequipAsset(
  assetNumber: number,
  owner: string,
): Promise<{ ok: boolean; error?: string }> {
  await connectDatabase();
  const result = await AssetModel.updateOne({ assetNumber, owner }, { $set: { equipped: false } });
  if (result.matchedCount === 0) return { ok: false, error: "Asset not found or wrong owner" };
  return { ok: true };
}

/**
 * Lists an asset on the market. Rejects soulbound assets.
 */
export async function listAsset(
  assetNumber: number,
  owner: string,
  price: number,
): Promise<{ ok: boolean; error?: string }> {
  await connectDatabase();
  const now = Date.now();
  const result = await AssetModel.updateOne(
    { assetNumber, owner, soulbound: false, equipped: false },
    { $set: { market: { price, listedAt: now, isMarket: true } } },
  );
  if (result.matchedCount === 0)
    return { ok: false, error: "Asset not found, is soulbound, or is equipped" };
  return { ok: true };
}

/**
 * Cancels an active asset listing.
 */
export async function cancelAssetListing(
  assetNumber: number,
  owner: string,
): Promise<{ ok: boolean; error?: string }> {
  await connectDatabase();
  const result = await AssetModel.updateOne(
    { assetNumber, owner, "market.isMarket": true },
    { $set: { market: null } },
  );
  if (result.matchedCount === 0) return { ok: false, error: "Listing not found" };
  return { ok: true };
}

/**
 * Returns all assets currently listed on the market.
 */
export async function findListedAssets(): Promise<IAsset[]> {
  await connectDatabase();
  return AssetModel.find({ "market.isMarket": true })
    .sort({ "market.listedAt": -1 })
    .lean<IAsset[]>();
}

/**
 * Transfers a non-soulbound asset to a new owner.
 */
export async function transferAsset(
  assetNumber: number,
  from: string,
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  await connectDatabase();
  const asset = await AssetModel.findOne({ assetNumber, owner: from });
  if (!asset) return { ok: false, error: "Asset not found or wrong owner" };
  if (asset.soulbound) return { ok: false, error: "Soulbound assets cannot be transferred" };

  asset.owner = to;
  asset.equipped = false;
  asset.market = null;
  asset.lastTransfer = Date.now();
  await asset.save();
  return { ok: true };
}
