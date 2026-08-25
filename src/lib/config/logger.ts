import { config } from "./config";

const ORDER: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

export type LogScope =
  | "API"
  | "DB"
  | "TX"
  | "SMART-CONTRACT"
  | "BLOCKCHAIN:MOCK"
  | "BLOCKCHAIN:HIVE"
  | "EVENT"
  | "SEED"
  | "KEYCHAIN"
  | "MARKETPLACE"
  | "STORAGE"
  | "ASSETS"
  | "IMPORT"
  | "AUTH";

function should(level: keyof typeof ORDER) {
  return (ORDER[level] ?? 0) >= (ORDER[config.logLevel] ?? 20);
}

function write(
  level: "debug" | "info" | "warn" | "error",
  scope: LogScope,
  msg: string,
  meta?: unknown,
) {
  if (!should(level)) return;
  const line = `[${scope}] ${msg}`;
  const args = meta === undefined ? [line] : [line, meta];
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else console.log(...args);
}

/** Structured development logger — swap the `write` sink for production logging later. */
export const logger = {
  debug: (scope: LogScope, msg: string, meta?: unknown) => write("debug", scope, msg, meta),
  info: (scope: LogScope, msg: string, meta?: unknown) => write("info", scope, msg, meta),
  warn: (scope: LogScope, msg: string, meta?: unknown) => write("warn", scope, msg, meta),
  error: (scope: LogScope, msg: string, meta?: unknown) => write("error", scope, msg, meta),
};
