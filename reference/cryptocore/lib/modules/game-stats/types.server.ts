// lib/modules/game-stats/types.server.ts
import type { Document } from "mongoose";

export interface IGameStat extends Omit<Document, "_id"> {
  _id: string; // counter/stat key, e.g. "itemNumber", "totalRaids"
  value: number; // current value
  updatedAt: number; // last write timestamp (ms)
}
