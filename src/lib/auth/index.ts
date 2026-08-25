import { DevAuthService } from "./dev-auth.service";
import type { AuthContext, AuthService } from "./auth.types";

/**
 * Auth entry point. Swap the implementation here in Phase 3:
 *
 *   Hive Keychain -> signed challenge -> KeychainAuthService -> AuthContext
 */
export const authService: AuthService = new DevAuthService();

export type { AuthContext, AuthService };
export { DevAuthService };
