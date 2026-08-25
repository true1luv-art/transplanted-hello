export interface AuthContext {
  userId: string;
  hiveAccount: string;
  displayName: string;
  /** Phase 2 is always `dev`; Phase 3 adds `keychain`. */
  method: "dev" | "keychain";
}

export interface AuthService {
  /** Resolves the caller from an incoming request. */
  authenticate(request: Request): Promise<AuthContext>;
  /** Resolves a caller outside HTTP (worker / scripts). */
  resolveAccount(hiveAccount: string): Promise<AuthContext>;
}
