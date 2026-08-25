import "@/features/stores/legacyStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  connectPhantom,
  disconnectPhantom,
  generateKeyPair,
  isPhantomInstalled,
  signMessage,
} from "@/lib/wallet";
import {
  generateChallenge,
  verifySignature,
  setAuthToken,
  setDemoMode,
  isDemoMode,
  getMe,
  loadAuthToken,
} from "@/lib/api/client";

export function shortAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}

export type AuthMode = "wallet" | "demo";

/**
 * Strict demo check used to gate any client-side fallback that mutates game
 * state locally (deposits, upgrades, staking, burns, raid targets, etc.).
 *
 * There are two independent signals for "are we in demo mode": the auth
 * store's `mode` and the lower-level API client's `isDemoMode()` flag (which
 * short-circuits network requests). They are kept in sync by this store, but
 * requiring BOTH to agree means a bug that desyncs one of them fails closed
 * — i.e. it blocks a fake local write against a real wallet session instead
 * of silently allowing it.
 */
export function isDemoSession(): boolean {
  return useAuthStore.getState().mode === "demo" && isDemoMode();
}

interface AuthState {
  address: string | null;
  username: string | null;
  /** Only set in demo mode — a throwaway local keypair, never a real wallet. */
  secret: string | null;
  mode: AuthMode | null;
  connectedAt: number | null;
  apiConnected: boolean | null;
  connectWallet: () => Promise<string | null>;
  playDemo: () => string;
  setUsername: (username: string) => Promise<void>;
  disconnect: () => void;
}

async function authWithServer(
  address: string,
  sign: (message: string) => Promise<string>,
): Promise<boolean> {
  const challenge = await generateChallenge(address);
  if (!challenge.ok || !challenge.nonce) return false;

  let signature: string;
  try {
    signature = await sign(challenge.nonce);
  } catch {
    return false;
  }

  const verify = await verifySignature(address, signature);
  if (!verify.ok || !verify.token) {
    setAuthToken(null);
    return false;
  }

  setAuthToken(verify.token);
  return true;
}

/**
 * Looks up the caller's already-registered username on the server. The
 * server assigns a placeholder username equal to the wallet address itself
 * for players who have never claimed a real one — that placeholder must be
 * treated the same as "no username yet" so the claim step still shows.
 *
 * `fallback` is returned on a network/lookup failure so a transient error
 * can't erase a username this browser already knew about — it only ever
 * resolves to a *fresher* answer, never a regression to "unknown".
 */
async function resolveExistingUsername(fallback: string | null): Promise<string | null> {
  try {
    const me = await getMe();
    if (me.ok && me.player) {
      return me.player.username !== me.player.address ? me.player.username : null;
    }
  } catch {
    // Best-effort: on failure, keep whatever this browser already knew.
  }
  return fallback;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      address: null,
      username: null,
      secret: null,
      mode: null,
      connectedAt: null,
      apiConnected: null,

      connectWallet: async () => {
        if (!isPhantomInstalled()) {
          throw new Error("Phantom wallet not found");
        }

        // Do NOT clear the demo flag yet: if the handshake below fails partway
        // (rejected signature, server verification failure, etc.) we must leave
        // `mode` and the demo flag exactly as they were — never a half-switched
        // state where the UI thinks "wallet" but the API layer still thinks "demo"
        // (or vice versa), which is what let demo-style local fallbacks run
        // against a real wallet session.
        const wallet = await connectPhantom();
        const apiConnected = await authWithServer(wallet.address, wallet.signMessage);

        if (!apiConnected) {
          setAuthToken(null);
          set({ apiConnected: false });
          throw new Error("Could not verify your wallet with the server");
        }

        // Only flip out of demo mode once the wallet is fully authenticated
        // with the server, atomically with the store's `mode` transition.
        setDemoMode(false);

        // If this wallet already claimed a username on a previous session
        // (e.g. a different device, or after a local disconnect wiped this
        // browser's persisted store), pick it up now so the modal's username
        // step is correctly skipped instead of re-prompting a returning player.
        const username = await resolveExistingUsername(get().username);

        set({
          address: wallet.address,
          username,
          secret: null,
          mode: "wallet",
          connectedAt: Date.now(),
          apiConnected: true,
        });
        return wallet.address;
      },

      playDemo: () => {
        const pair = generateKeyPair();
        setAuthToken(null);
        setDemoMode(true);
        set({
          address: pair.address,
          secret: pair.secret,
          mode: "demo",
          connectedAt: Date.now(),
          apiConnected: false,
        });
        return pair.address;
      },

      setUsername: async (username) => {
        const trimmed = username.trim();
        if (!trimmed) return;
        set({ username: trimmed });

        if (get().mode === "wallet" && get().apiConnected) {
          const result = await import("@/lib/api/client").then((m) => m.updateProfile(trimmed));
          if (!result.ok) set({ apiConnected: false });
        }
      },

      disconnect: () => {
        setAuthToken(null);
        setDemoMode(false);
        void disconnectPhantom();
        set({
          address: null,
          username: null,
          secret: null,
          mode: null,
          connectedAt: null,
          apiConnected: null,
        });
      },
    }),
    {
      name: "cryptocore-auth",
      version: 4,
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        if (state.mode === "demo" && state.address) {
          setDemoMode(true);
          state.apiConnected = false;
          return;
        }

        setDemoMode(false);
        if (state.mode === "wallet" && state.address) {
          // The server JWT is a long-lived token already persisted in
          // localStorage (see setAuthToken/loadAuthToken) — reuse it instead
          // of forcing a brand-new Phantom "sign message" popup on every
          // page refresh. Only fall back to the full challenge+sign
          // handshake (which does prompt Phantom) if that token is missing
          // or the server has since rejected it (expired/invalid).
          void (async () => {
            try {
              const existingToken = loadAuthToken();
              if (existingToken) {
                const me = await getMe();
                if (me.ok) {
                  useAuthStore.setState({ apiConnected: true });
                  return;
                }
              }

              const wallet = await connectPhantom();
              if (wallet.address !== state.address) {
                useAuthStore.getState().disconnect();
                return;
              }
              const ok = await authWithServer(wallet.address, wallet.signMessage);
              useAuthStore.setState({ apiConnected: ok });
              if (!ok) setAuthToken(null);
            } catch {
              useAuthStore.setState({ apiConnected: false });
              setAuthToken(null);
            }
          })();
        } else {
          state.apiConnected = false;
        }
      },
    },
  ),
);
