import { appData } from "@/features/lib/data/app-data";
import { applyDelta, canAfford } from "@/features/mocks/data/users/model";
import { MOCK_HIVE_USERNAME } from "@/features/lib/data/seed-data";
import type { BalanceLedger, User } from "@/features/types/domain/users";

export const usersRepository = {
  current(): User | null {
    return appData.read().user;
  },

  currentUsername(): string {
    return appData.read().user?.username ?? MOCK_HIVE_USERNAME;
  },

  /** Replaces the session user record (used when Hive profile data arrives). */
  setProfile(user: User): void {
    appData.patch({ user });
  },


  balances(): BalanceLedger {
    return appData.read().balances;
  },

  balanceOf(username: string): number {
    return appData.read().balances[username] ?? 0;
  },

  canAfford(username: string, amount: number): boolean {
    return canAfford(appData.read().balances, username, amount);
  },

  setBalance(username: string, amount: number): void {
    appData.update((s) => ({
      balances: { ...s.balances, [username]: amount },
      hiveBalance: s.user?.username === username ? amount : s.hiveBalance,
    }));
  },

  adjustBalance(username: string, delta: number): void {
    appData.update((s) => {
      const balances = applyDelta(s.balances, username, delta);
      return {
        balances,
        hiveBalance: balances[s.user?.username ?? ""] ?? s.hiveBalance,
      };
    });
  },

  setSession(user: User | null, options?: { connected?: boolean; balance?: number }): void {
    appData.update((s) => ({
      user,
      walletConnected: options?.connected ?? Boolean(user),
      connecting: false,
      hiveBalance: user
        ? (s.balances[user.username] ?? options?.balance ?? s.hiveBalance)
        : s.hiveBalance,
    }));
  },

  setConnecting(connecting: boolean): void {
    appData.patch({ connecting });
  },
};
