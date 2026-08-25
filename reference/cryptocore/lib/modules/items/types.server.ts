import type { Document } from "mongoose";
import type { Rarity, SlotKey, StatRoll } from "@/features/types/game";

export interface IItemMarket {
  price: number;
  listedAt: number;
  isMarket: boolean;
}

export interface IItemBase {
  itemNumber: number; // unique global serial across all items
  templateId: number; // numeric template ID (1000–6999) — links to templates collection
  mintNumber: number; // edition number for this templateId (e.g. 47th sword of this template)
  owner: string | null; // wallet address
  name: string;
  slot: SlotKey;
  rarity: Rarity;
  level: number;
  stats: StatRoll;
  equipped: boolean;
  salvaged: boolean;
  market?: IItemMarket | null;
  createdAt: number;
  lastTransfer: number;
}

export interface IItem extends IItemBase, Document {}

export type ItemInput = IItemBase;
