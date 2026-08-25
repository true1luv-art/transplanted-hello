/**
 * server/smart-contract/lib/logger.ts
 *
 * Worker-scoped logger. Delegates to the application logger but tags every
 * line with the worker id and redacts anything that looks like a key/secret,
 * so an active key can never reach the logs.
 *
 * SERVER-ONLY.
 */
import { logger as appLogger } from "@/lib/config/logger";

type Meta = Record<string, unknown> | undefined;

function redact(meta: Meta): Meta {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = /key|secret|private|wif/i.test(key) ? "***" : value;
  }
  return out;
}

export interface WorkerLogger {
  debug(message: string, meta?: Meta): void;
  info(message: string, meta?: Meta): void;
  warn(message: string, meta?: Meta): void;
  error(message: string, meta?: Meta): void;
}

/** Creates a logger tagged with the worker id (`[SMART-CONTRACT] worker-x: …`). */
export function createWorkerLogger(workerId: string): WorkerLogger {
  const tag = (message: string) => `${workerId}: ${message}`;
  return {
    debug: (message, meta) => appLogger.debug("SMART-CONTRACT", tag(message), redact(meta)),
    info: (message, meta) => appLogger.info("SMART-CONTRACT", tag(message), redact(meta)),
    warn: (message, meta) => appLogger.warn("SMART-CONTRACT", tag(message), redact(meta)),
    error: (message, meta) => appLogger.error("SMART-CONTRACT", tag(message), redact(meta)),
  };
}

/** Process-level logger for the worker entrypoint (startup / shutdown). */
export const workerLogger = createWorkerLogger("process");
