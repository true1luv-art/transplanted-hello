import { create } from "zustand";

import { applyRaidToRival, generateRivals } from "@/features/game/raid";
import type { RaidOutcome, Rival } from "@/features/types/game";
import { getRaidTargets } from "@/lib/api/client";
import { isDemoSession } from "@/features/stores/authStore";

const POLL_INTERVAL_MS = 10_000;

interface RaidState {
  rivals: Rival[];
  /** Player Hack Power the current pool was generated for. */
  scaledFor: number;
  loading: boolean;
  lastOutcome: (RaidOutcome & { rivalId: string; username: string }) | null;
  /** Fetch real targets from the API (or fall back to mock in demo mode). */
  refreshRivals: (playerHackPower: number) => Promise<void>;
  applyOutcome: (rivalId: string, outcome: RaidOutcome, username: string) => void;
  clearOutcome: () => void;
  reset: () => void;
  /** Start background polling every 10 s. Returns a cleanup fn. */
  startPolling: (playerHackPower: number) => () => void;
}

/** Not persisted: a fresh rival pool is fetched (or generated) every reload. */
export const useRaidStore = create<RaidState>()((set, get) => ({
  rivals: [],
  scaledFor: 0,
  loading: false,
  lastOutcome: null,

  refreshRivals: async (playerHackPower: number) => {
    set({ loading: true, scaledFor: playerHackPower });

    if (isDemoSession()) {
      set({ rivals: generateRivals(playerHackPower), loading: false });
      return;
    }

    const result = await getRaidTargets(playerHackPower);
    if (result.ok) {
      // A real, successful response — even an empty list — must be shown as-is.
      // There may simply be no other players with weak enough security right
      // now; that is a legitimate state, not a failure, and must never be
      // papered over with fabricated rival names/vaults for a real session.
      set({ rivals: result.rivals ?? [], loading: false });
    } else {
      // Only fall back to the client-side mock generator when the request
      // itself failed (network error, server error) — never on a merely
      // empty result.
      set({ rivals: generateRivals(playerHackPower), loading: false });
    }
  },

  applyOutcome: (rivalId, outcome, username) =>
    set((state) => ({
      rivals: state.rivals.map((rival) =>
        rival.id === rivalId ? applyRaidToRival(rival, outcome) : rival,
      ),
      lastOutcome: { ...outcome, rivalId, username },
    })),

  clearOutcome: () => set({ lastOutcome: null }),

  reset: () => set({ rivals: [], scaledFor: 0, loading: false, lastOutcome: null }),

  startPolling: (playerHackPower: number) => {
    // Fetch immediately
    void get().refreshRivals(playerHackPower);

    const intervalId = setInterval(() => {
      const current = get();
      void current.refreshRivals(current.scaledFor || playerHackPower);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  },
}));
