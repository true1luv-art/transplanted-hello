import { useCallback, useEffect, useState } from "react";

import {
  getActivityLogs,
  getMarketSales,
  getMarketSalesByKind,
  getMyMarketLogs,
  getMyMarketLogsByKind,
  isDemoMode,
} from "@/lib/api/client";
import type { LogDto } from "@/lib/api/types";

type Source =
  | "activity"
  | "market"
  | "market_items"
  | "market_assets"
  | "sales"
  | "sales_items"
  | "sales_assets";

const fetchers: Record<Source, (limit: number) => Promise<{ ok: boolean; logs?: LogDto[] }>> = {
  activity: getActivityLogs,
  market: getMyMarketLogs,
  market_items: (limit) => getMyMarketLogsByKind("item", limit),
  market_assets: (limit) => getMyMarketLogsByKind("asset", limit),
  sales: getMarketSales,
  sales_items: (limit) => getMarketSalesByKind("item", limit),
  sales_assets: (limit) => getMarketSalesByKind("asset", limit),
};

const POLL_INTERVAL_MS = 10_000;

/**
 * Reads the server `logs` collection. Silently yields an empty list in demo
 * mode or when the API is unreachable so the UI can fall back to local state.
 *
 * Polls every 10s so new activity (chests, upgrades, vault stakes, market
 * trades) shows up without the player needing to refresh the page.
 */
export function useServerLogs(source: Source, enabled = true, limit = 50) {
  const [logs, setLogs] = useState<LogDto[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || isDemoMode()) {
      setLogs([]);
      return;
    }
    setLoading(true);
    const result = await fetchers[source](limit);
    setLogs(result.ok && result.logs ? result.logs : []);
    setLoading(false);
  }, [source, enabled, limit]);

  useEffect(() => {
    void refresh();

    if (!enabled || isDemoMode()) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refresh, enabled]);

  return { logs, loading, refresh };
}
