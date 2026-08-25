import { hiveAvatarUrl } from "@/lib/chain/identity";
import type { BalanceLedger, User } from "@/features/types/domain/users";

/** Builds the local view of a Hive account before chain data is available. */
export function buildUser(username: string, displayName?: string): User {
  return {
    username,
    displayName: displayName ?? username,
    avatarUrl: hiveAvatarUrl(username),
  };
}

/** Merges a real Hive account snapshot onto the local user record. */
export function applyChainProfile(
  user: User | null,
  profile: {
    username: string;
    displayName: string;
    avatarUrl: string;
    coverImage?: string;
    about?: string;
    location?: string;
    website?: string;
  },
): User {
  return {
    ...(user ?? buildUser(profile.username)),
    username: profile.username,
    displayName: profile.displayName || profile.username,
    avatarUrl: profile.avatarUrl,
    ...(profile.coverImage ? { coverImage: profile.coverImage } : {}),
    ...(profile.about ? { about: profile.about } : {}),
    ...(profile.location ? { location: profile.location } : {}),
    ...(profile.website ? { website: profile.website } : {}),
    chainSynced: true,
  };
}

/** Applies a signed delta to one account's balance. */
export function applyDelta(
  balances: BalanceLedger,
  username: string,
  delta: number,
): BalanceLedger {
  const next = Number(((balances[username] ?? 0) + delta).toFixed(2));
  return { ...balances, [username]: next };
}

export const canAfford = (balances: BalanceLedger, username: string, amount: number) =>
  (balances[username] ?? 0) >= amount;
