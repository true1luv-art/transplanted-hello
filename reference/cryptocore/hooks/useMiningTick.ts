import { useEffect, useRef } from "react";

import { notify } from "@/lib/notify";
import { usePlayerStore } from "@/features/stores/playerStore";
import { useGameStats } from "@/hooks/useGameStats";

/**
 * Drives the idle loop: one mining tick per second, plus a catch-up credit for
 * time spent away. Mounted once, in the app shell.
 */
export const useMiningTick = (): void => {
  const { total, isFull } = useGameStats();
  const hashRate = total.hashRate;
  const hashRateRef = useRef(hashRate);
  const fullNotifiedRef = useRef(false);

  hashRateRef.current = hashRate;

  useEffect(() => {
    usePlayerStore.getState().recordHashRate(hashRate);
  }, [hashRate]);

  // Credit offline mining once on mount.
  useEffect(() => {
    const { lastTickAt, tick } = usePlayerStore.getState();
    const elapsed = (Date.now() - lastTickAt) / 1000;
    if (elapsed > 2) {
      const { mined } = tick(hashRateRef.current, elapsed);
      if (mined > 1) notify(`Mined ${mined.toFixed(2)} HASH while you were away`, "info");
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const { becameFull } = usePlayerStore.getState().tick(hashRateRef.current, 1);
      if (becameFull && !fullNotifiedRef.current) {
        fullNotifiedRef.current = true;
        notify("Vault full — claim your HASH", "danger");
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isFull) fullNotifiedRef.current = false;
  }, [isFull]);
};
