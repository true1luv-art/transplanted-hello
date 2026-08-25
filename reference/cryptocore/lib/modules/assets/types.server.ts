import type { Document } from "mongoose";

export type AssetKind = "avatar" | "banner" | "background";

export interface IAssetMarket {
  price: number;
  listedAt: number;
  isMarket: boolean;
}

export interface IAsset extends Document {
  assetNumber: number; // global serial from nextCounter("assetNumber")
  templateId: number; // 0–299 (cosmetics only)
  kind: AssetKind;
  owner: string; // wallet address
  soulbound: boolean; // inherited from template at mint time
  mintNumber: number; // this edition's number (e.g. 47 of 500)
  equipped: boolean;
  market?: IAssetMarket | null;
  createdAt: number;
  lastTransfer: number;
}

export type AssetInput = Omit<IAsset, keyof Document>;
