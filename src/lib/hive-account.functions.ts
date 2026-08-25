/**
 * Read-only Hive account snapshot exposed to the frontend.
 *
 * Thin wrapper: all chain access happens inside the handler through the single
 * Hive abstraction (`@/lib/chain/hive`). No dHive client is created here and
 * none is ever created in React components.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface HiveAccountSnapshot {
  username: string;
  displayName: string;
  about?: string;
  /** Derived Hive avatar (metadata image wins when the account published one). */
  avatarUrl: string;
  /** Profile banner/background published in the account metadata, when present. */
  coverImage?: string;
  location?: string;
  website?: string;
  /** Liquid HIVE balance straight from the chain. */
  hiveBalance: number;
}

export const getHiveAccountSnapshot = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ username: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<HiveAccountSnapshot | null> => {
    const { getAccount, parseAccountProfile, readAccountHiveBalance } = await import(
      "@/lib/chain/hive"
    );
    const { hiveAvatarUrl, hiveCoverUrl } = await import("@/lib/chain/identity");
    try {
      const account = await getAccount(data.username);
      const profile = parseAccountProfile(account);
      return {
        username: profile.username,
        displayName: profile.displayName ?? profile.username,
        ...(profile.about ? { about: profile.about } : {}),
        // Always use the Hive image CDN: it serves the account's published
        // profile image/cover and stays reachable when the raw metadata URL is not.
        avatarUrl: hiveAvatarUrl(profile.username),
        coverImage: hiveCoverUrl(profile.username),
        ...(profile.location ? { location: profile.location } : {}),
        ...(profile.website ? { website: profile.website } : {}),
        hiveBalance: readAccountHiveBalance(account),
      };
    } catch {
      // Hive unreachable / account missing: the mock experience must survive.
      return null;
    }
  });
