/**
 * Hydrates the local (mock) session user with REAL Hive account data:
 * display name, avatar, profile banner and liquid HIVE balance.
 *
 * NFTs, collections and marketplace data stay mocked — only the user identity
 * is blockchain-backed. Failures are non-fatal: the mock experience survives
 * without Hive connectivity.
 */
import { getHiveAccountSnapshot } from "@/lib/hive-account.functions";
import { applyChainProfile } from "@/features/mocks/data/users/model";
import { usersRepository } from "@/features/mocks/data/users/repository";
import type { User } from "@/features/types/domain/users";

export interface SyncHiveProfileResult {
  user: User | null;
  synced: boolean;
}

export async function syncHiveProfile(username?: string): Promise<SyncHiveProfileResult> {
  const account = username ?? usersRepository.currentUsername();
  if (!account) return { user: usersRepository.current(), synced: false };

  try {
    const snapshot = await getHiveAccountSnapshot({ data: { username: account } });
    if (!snapshot) return { user: usersRepository.current(), synced: false };

    const user = applyChainProfile(usersRepository.current(), snapshot);
    usersRepository.setProfile(user);
    usersRepository.setBalance(user.username, snapshot.hiveBalance);
    return { user, synced: true };
  } catch {
    return { user: usersRepository.current(), synced: false };
  }
}
