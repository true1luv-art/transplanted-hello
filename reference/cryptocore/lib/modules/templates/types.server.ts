import type { Document, Types } from "mongoose";

export type TemplateKind = "avatar" | "banner" | "background" | "item";

// Separate the plain data shape from the Mongoose document type so that
// _id can be a numeric templateId without conflicting with Document<ObjectId>.
export interface ITemplateData {
  _id: number; // templateId — the numeric namespace ID (primary key)
  kind: TemplateKind;
  name: string;
  image: string;
  // Cosmetics-only fields (null for items)
  maxSupply: number | null; // null = unlimited (soulbound cosmetics only)
  soulbound: boolean; // true only for templateId 0, 100, 200
  // Items-only fields (null for cosmetics)
  slot: string | null; // SlotKey
  rarity: string | null; // Rarity
  // Shared tracking
  mintCount: number; // atomically incremented on each mint
}

// Mongoose document type — _id is overridden to number via the schema
export interface ITemplate extends Omit<Document<Types.ObjectId>, "_id">, ITemplateData {}
