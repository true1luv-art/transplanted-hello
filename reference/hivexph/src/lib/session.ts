/**
 * lib/session.ts
 *
 * Stub during phased port. Real implementation lands in Phase 6 (Keychain +
 * session cookie). For now `getSession()` always returns null and callers
 * that need a username should accept it as an argument instead.
 */

import { SESSION_COOKIE, type AppUser } from "@/lib/session-shared";

export { SESSION_COOKIE, type AppUser } from "@/lib/session-shared";

export async function getSession(): Promise<AppUser | null> {
  return null;
}

export function guestUser(): AppUser {
  return {
    username: "",
    fullName: "",
    avatarInitials: "?",
    isLoggedIn: false,
  };
}
