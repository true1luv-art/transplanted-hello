import { config } from "../config/config";
import { logger } from "../config/logger";
import { usersRepository } from "@/lib/modules/users/repository.server";
import type { AuthContext, AuthService } from "./auth.types";

/**
 * Development authentication.
 *
 * The caller is identified by the `x-hive-account` header and falls back to the
 * configured development user (@alice). No signatures, no keys.
 *
 * Phase 3 replaces this class with `KeychainAuthService`, which will verify a
 * Hive Keychain signed challenge and resolve the same `AuthContext` — every
 * feature keeps working unchanged.
 */
export class DevAuthService implements AuthService {
  async authenticate(request: Request): Promise<AuthContext> {
    const header = request.headers.get("x-hive-account")?.trim().replace(/^@/, "");
    const account = header && /^[a-z0-9.-]{3,16}$/.test(header) ? header : config.devUser;
    return this.resolveAccount(account);
  }

  async resolveAccount(hiveAccount: string): Promise<AuthContext> {
    const user = await usersRepository.ensure({ username: hiveAccount });
    logger.debug("AUTH", `Resolved dev account @${user.username}`);
    return {
      userId: user.id,
      hiveAccount: user.username,
      displayName: user.username,
      method: "dev",
    };
  }
}
