import { ensureSeeded } from "@/server/scripts/seed";
import { logger } from "./logger";

let ready: Promise<unknown> | null = null;

/** Seeds the database once per process before the first read/write. */
export async function ensureReady(): Promise<void> {
  if (!ready)
    ready = ensureSeeded().catch((error) => {
      ready = null;
      logger.error("API", "Seed failed", error);
      throw error;
    });
  await ready;
}
