/**
 * lib/session-shared.ts
 *
 * Constants and types shared between server and client modules.
 * This file MUST NOT import anything from "next/headers" or any other
 * server-only package so that client components can safely import from it.
 */

export const SESSION_COOKIE = "hivep2p_user";

export interface AppUser {
  username:       string;
  /** Display name from Hive profile (may be empty — fall back to username in UI) */
  fullName:       string;
  avatarInitials: string;
  /** True when the user has signed in via Hive Keychain. */
  isLoggedIn:     boolean;
}
