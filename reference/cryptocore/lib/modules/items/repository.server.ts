// src/lib/modules/items/repository.server.ts
import { ItemModel } from "./model.server";
import type { IItem, ItemInput } from "./types.server";
import { connectDatabase } from "@/lib/config/database";
import { nextCounter } from "@/lib/modules/game-stats/repository.server";
import { upgradedStats } from "@/features/game/items";
import type { StatRoll } from "@/features/types/game";

export async function findItemByNumber(itemNumber: number): Promise<IItem | null> {
  await connectDatabase();
  return ItemModel.findOne({ itemNumber }).lean<IItem>();
}

export async function findItemsByNumbers(itemNumbers: number[]): Promise<IItem[]> {
  await connectDatabase();
  if (itemNumbers.length === 0) return [];
  return ItemModel.find({ itemNumber: { $in: itemNumbers } }).lean<IItem[]>();
}

export async function findItemsByOwner(owner: string): Promise<IItem[]> {
  await connectDatabase();
  return ItemModel.find({ owner, salvaged: { $ne: true } }).lean<IItem[]>();
}

export async function findEquippedItems(owner: string): Promise<IItem[]> {
  await connectDatabase();
  return ItemModel.find({ owner, equipped: true, salvaged: { $ne: true } }).lean<IItem[]>();
}

export async function insertItem(input: ItemInput): Promise<IItem> {
  await connectDatabase();
  return ItemModel.create(input);
}

/**
 * Returns the next globally unique item serial number.
 * Uses an atomic $inc on the game-stats collection — safe under concurrency.
 */
export async function mintNextItemNumber(): Promise<number> {
  return nextCounter("itemNumber");
}

export async function equipItem(
  itemNumber: number,
  owner: string,
): Promise<{ ok: boolean; item?: IItem; error?: string }> {
  await connectDatabase();
  const item = await ItemModel.findOne({ itemNumber, owner });
  if (!item) return { ok: false, error: "Item not found or wrong owner" };
  if (item.salvaged) return { ok: false, error: "Item is salvaged" };

  // Unequip any other item in the same slot first.
  await ItemModel.updateMany(
    { owner, slot: item.slot, equipped: true },
    { $set: { equipped: false } },
  );

  item.equipped = true;
  await item.save();
  return { ok: true, item: item.toObject() };
}

export async function unequipItem(
  itemNumber: number,
  owner: string,
): Promise<{ ok: boolean; item?: IItem; error?: string }> {
  await connectDatabase();
  const item = await ItemModel.findOne({ itemNumber, owner });
  if (!item) return { ok: false, error: "Item not found or wrong owner" };
  item.equipped = false;
  await item.save();
  return { ok: true, item: item.toObject() };
}

export async function salvageItem(
  itemNumber: number,
  owner: string,
): Promise<{ ok: boolean; item?: IItem; error?: string }> {
  await connectDatabase();
  const item = await ItemModel.findOne({ itemNumber, owner });
  if (!item) return { ok: false, error: "Item not found or wrong owner" };
  if (item.equipped) return { ok: false, error: "Item is equipped" };
  if (item.salvaged) return { ok: false, error: "Already salvaged" };
  item.salvaged = true;
  item.equipped = false;
  item.market = null;
  item.owner = null;
  await item.save();
  return { ok: true, item: item.toObject() };
}

export async function upgradeItem(
  itemNumber: number,
  owner: string,
): Promise<{ ok: boolean; item?: IItem; error?: string }> {
  await connectDatabase();
  const item = await ItemModel.findOne({ itemNumber, owner });
  if (!item) return { ok: false, error: "Item not found or wrong owner" };
  // Every level must also scale the rolled stats (reference forge: x1.05
  // per level). Bumping `level` alone left the item's actual power
  // completely unchanged — the SPARKS cost was real, the upgrade was not.
  item.stats = upgradedStats(item.stats as StatRoll) as IItem["stats"];
  item.level += 1;
  await item.save();
  return { ok: true, item: item.toObject() };
}

/**
 * Lists an item on the market. Rejects equipped or salvaged items.
 */
export async function listItemForSale(
  itemNumber: number,
  owner: string,
  price: number,
): Promise<{ ok: boolean; error?: string }> {
  await connectDatabase();
  const now = Date.now();
  const result = await ItemModel.updateOne(
    { itemNumber, owner, equipped: false, salvaged: { $ne: true } },
    { $set: { market: { price, listedAt: now, isMarket: true } } },
  );
  if (result.matchedCount === 0)
    return { ok: false, error: "Item not found, is equipped, or is salvaged" };
  return { ok: true };
}

/**
 * Cancels an active item listing.
 */
export async function cancelItemListing(
  itemNumber: number,
  owner: string,
): Promise<{ ok: boolean; error?: string }> {
  await connectDatabase();
  const result = await ItemModel.updateOne(
    { itemNumber, owner, "market.isMarket": true },
    { $set: { market: null } },
  );
  if (result.matchedCount === 0) return { ok: false, error: "Listing not found" };
  return { ok: true };
}

/**
 * Returns all items currently listed on the market.
 */
export async function findListedItems(): Promise<IItem[]> {
  await connectDatabase();
  return ItemModel.find({ "market.isMarket": true, salvaged: { $ne: true } })
    .sort({ "market.listedAt": -1 })
    .lean<IItem[]>();
}

export async function transferOwnership(
  itemNumber: number,
  from: string,
  to: string,
): Promise<{ ok: boolean; item?: IItem; error?: string }> {
  await connectDatabase();
  const item = await ItemModel.findOne({ itemNumber, owner: from });
  if (!item) return { ok: false, error: "Item not found or wrong owner" };
  item.owner = to;
  item.equipped = false;
  item.market = null;
  item.lastTransfer = Date.now();
  await item.save();
  return { ok: true, item: item.toObject() };
}
