import { logger as sharedLogger, type LogScope } from "@/lib/config/logger";

export { type LogScope } from "@/lib/config/logger";

export const logger = {
  debug: (scope: LogScope, msg: string, meta?: unknown) => sharedLogger.debug(scope, msg, meta),
  info: (scope: LogScope, msg: string, meta?: unknown) => sharedLogger.info(scope, msg, meta),
  warn: (scope: LogScope, msg: string, meta?: unknown) => sharedLogger.warn(scope, msg, meta),
  error: (scope: LogScope, msg: string, meta?: unknown) => sharedLogger.error(scope, msg, meta),
};
