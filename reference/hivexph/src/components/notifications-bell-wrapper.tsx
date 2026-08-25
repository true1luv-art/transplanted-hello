import { useCallback, useMemo, useState } from "react";
import {
  NotificationsBell,
  type NotificationItem,
} from "@/components/notifications-bell";
import { useApi, fetchRecentTransactions } from "@/hooks/useAxios";

const STORAGE_KEY = "hivep2p_notifications_read";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return new Set(stored ? (JSON.parse(stored) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* best-effort */
  }
}

interface Props {
  username?: string;
}

export function NotificationsBellWrapper({ username }: Props = {}) {
  const { data } = useApi(
    username
      ? [`notifications-recent:${username}`, () => fetchRecentTransactions(username)]
      : null,
    { refreshInterval: 30_000 },
  );

  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());

  const notifications = useMemo<NotificationItem[]>(
    () =>
      (data?.txns ?? []).map((tx) => {
        const counterparty = tx.incoming ? tx.from : tx.to;
        const amt = parseFloat(String(tx.amount ?? "0"));
        const amountStr = Number.isFinite(amt)
          ? amt.toLocaleString(undefined, { maximumFractionDigits: 8 })
          : String(tx.amount ?? "");
        return {
          id: tx._id,
          title: `Transfer · ${amountStr} ${tx.symbol}`,
          message: `${tx.incoming ? "Received from" : "Sent to"} @${counterparty}`,
          when: new Date(tx.timestamp),
          read: readIds.has(tx._id),
        };
      }),
    [data, readIds],
  );

  const handleMarkAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      saveReadIds(updated);
      return updated;
    });
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const updated = new Set(prev);
      (data?.txns ?? []).forEach((tx) => updated.add(tx._id));
      saveReadIds(updated);
      return updated;
    });
  }, [data]);

  return (
    <NotificationsBell
      notifications={notifications}
      onMarkAsRead={handleMarkAsRead}
      onMarkAllAsRead={handleMarkAllAsRead}
      username={username}
    />
  );
}
