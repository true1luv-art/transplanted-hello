/**
 * Resolves the profile shown on a public account page.
 *
 * Owner: the session user record (kept fresh with a Hive sync).
 * Visitor: a read-only snapshot fetched straight from the Hive chain.
 */
import { useEffect, useState } from "react";

import { getHiveAccountSnapshot } from "@/lib/hive-account.functions";
import { normalizeHiveUsername } from "@/lib/chain/identity";
import type { User } from "@/features/types/domain/users";
import { useAppStore } from "@/features/stores/app-store";

export interface HiveProfileState {
  /** Normalized Hive account name from the URL. */
  username: string;
  profile: User | null;
  isOwner: boolean;
  loading: boolean;
}

export function useHiveProfile(rawUsername: string): HiveProfileState {
  const username = normalizeHiveUsername(rawUsername);
  const sessionUser = useAppStore((s) => s.user);
  const syncProfile = useAppStore((s) => s.syncHiveProfile);
  const isOwner = Boolean(sessionUser && sessionUser.username === username);

  const [visitorProfile, setVisitorProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isOwner);

  useEffect(() => {
    if (isOwner) {
      setLoading(false);
      void syncProfile();
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getHiveAccountSnapshot({ data: { username } })
      .then((snapshot) => {
        if (cancelled) return;
        setVisitorProfile(
          snapshot
            ? {
                username: snapshot.username,
                displayName: snapshot.displayName,
                avatarUrl: snapshot.avatarUrl,
                ...(snapshot.coverImage ? { coverImage: snapshot.coverImage } : {}),
                ...(snapshot.about ? { about: snapshot.about } : {}),
                ...(snapshot.location ? { location: snapshot.location } : {}),
                ...(snapshot.website ? { website: snapshot.website } : {}),
                chainSynced: true,
              }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setVisitorProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, isOwner, syncProfile]);

  return {
    username,
    profile: isOwner ? sessionUser : visitorProfile,
    isOwner,
    loading,
  };
}
