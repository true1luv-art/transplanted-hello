// lib/modules/game-stats/repository.server.ts
import { GameStatModel } from "./model.server";
import { connectDatabase } from "@/lib/config/database";

/**
 * Atomically increments a named counter by `by` (default 1) and returns the NEW value.
 * Creates the document on first use — no manual seeding required.
 * Safe under concurrent requests: MongoDB's $inc is atomic.
 */
export async function nextCounter(key: string, by = 1): Promise<number> {
  await connectDatabase();
  const doc = await GameStatModel.findOneAndUpdate(
    { _id: key },
    { $inc: { value: by }, $set: { updatedAt: Date.now() } },
    { upsert: true, new: true },
  );
  return doc!.value;
}

/**
 * Atomically increments a stat counter without returning the new value.
 * Use for fire-and-forget stat tracking (e.g. totalRaids, totalHashMined).
 */
export async function incrementStat(key: string, by = 1): Promise<void> {
  await connectDatabase();
  await GameStatModel.updateOne(
    { _id: key },
    { $inc: { value: by }, $set: { updatedAt: Date.now() } },
    { upsert: true },
  );
}

/**
 * Overwrites a stat with an absolute value.
 * Use for snapshots that are periodically recomputed (e.g. activePlayers24h).
 */
export async function setStat(key: string, value: number): Promise<void> {
  await connectDatabase();
  await GameStatModel.updateOne(
    { _id: key },
    { $set: { value, updatedAt: Date.now() } },
    { upsert: true },
  );
}

/**
 * Reads all game stats as a plain key→value map.
 */
export async function getAllStats(): Promise<Record<string, number>> {
  await connectDatabase();
  const docs = await GameStatModel.find({}).lean<{ _id: string; value: number }[]>();
  return Object.fromEntries(docs.map((d) => [d._id, d.value]));
}
