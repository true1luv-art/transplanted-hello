import mongoose from "mongoose";
import { config } from "./config";
import { logger } from "./logger";

/**
 * MongoDB connection — Mongoose singleton.
 *
 * The promise is cached on `globalThis` so the connection survives dev-server
 * hot reloads and is shared by the API service, the smart-contract worker and
 * the scripts running in the same process. Every repository function awaits
 * `connectDatabase()` before touching a model — with `bufferCommands: false`
 * a missing/unreachable server fails fast instead of queueing operations.
 *
 * SERVER-ONLY. Never import from browser code; `helpers.ts` holds the
 * browser-safe shared pieces.
 */

declare global {
  // eslint-disable-next-line no-var
  var __hivexMongoose: Promise<typeof mongoose> | undefined;
}

/** Connects to MongoDB once per process and returns the mongoose instance. */
export async function connectDatabase(): Promise<typeof mongoose> {
  if (!config.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Provide a MongoDB connection string (e.g. mongodb://localhost:27017).",
    );
  }
  if (!globalThis.__hivexMongoose) {
    mongoose.set("strictQuery", true);
    globalThis.__hivexMongoose = mongoose.connect(config.databaseUrl, {
      dbName: config.databaseName,
      bufferCommands: false,
      serverSelectionTimeoutMS: 5_000,
      autoIndex: true,
    });
    globalThis.__hivexMongoose
      .then(() =>
        logger.info("DB", "Connected to MongoDB", { database: config.databaseName }),
      )
      .catch((error: unknown) => {
        globalThis.__hivexMongoose = undefined;
        logger.error("DB", "MongoDB connection failed", error);
      });
  }
  return globalThis.__hivexMongoose;
}

/** Disconnects from MongoDB (used by scripts and graceful shutdown). */
export async function closeDatabase(): Promise<void> {
  globalThis.__hivexMongoose = undefined;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Splits a partial patch into a MongoDB `$set`/`$unset` update so explicit
 * `undefined` values CLEAR the field — matching the legacy update semantics
 * (`{ a: undefined }` removes `a`).
 */
export function toUpdate(patch: object): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) unset[key] = 1;
    else set[key] = value;
  }
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update["$set"] = set;
  if (Object.keys(unset).length > 0) update["$unset"] = unset;
  return update;
}

/** true when the error is a MongoDB duplicate-key violation (unique index). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

export interface DatabaseStatus {
  connected: boolean;
  driver: "mongodb";
  name?: string;
  collections?: string[];
  error?: string;
}

/** Ping the database without throwing. Used by /api/health and backend:check. */
export async function checkDatabaseConnection(): Promise<DatabaseStatus> {
  if (!config.databaseUrl) {
    return { connected: false, driver: "mongodb", error: "DATABASE_URL is not set" };
  }
  try {
    await connectDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB connection has no active database handle");
    await db.command({ ping: 1 });
    const names = await db.listCollections().toArray();
    return {
      connected: true,
      driver: "mongodb",
      name: db.databaseName,
      collections: names.map((c) => c.name),
    };
  } catch (error) {
    globalThis.__hivexMongoose = undefined;
    return {
      connected: false,
      driver: "mongodb",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
