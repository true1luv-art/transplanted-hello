import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Mail, Store } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/features/stores/notificationStore";
import { useReadNotificationsStore } from "@/features/stores/readNotificationsStore";
import { useAuthStore } from "@/features/stores/authStore";
import { useServerLogs } from "@/hooks/useServerLogs";
import { marketLogMessage, toActivityEntry, toMarketRow } from "@/lib/logs-format";
import type { ActivityEntry } from "@/features/types/game";

const toneMap: Record<ActivityEntry["kind"], string> = {
  info: "bg-muted-foreground",
  success: "bg-success",
  danger: "bg-danger",
  loot: "bg-accent",
};

const MARKET_PATTERN = /\b(sold|bought|listed|listing|market|purchase|purchased)\b/i;

function isMarketEntry(entry: ActivityEntry): boolean {
  return MARKET_PATTERN.test(entry.message);
}

type Tab = "activity" | "market";

/** The sidebar collapses into a sheet below 1024px, where a right-side popover
 *  would spill outside the viewport — flip it below the trigger instead. */
function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setNarrow(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

function EntryList({
  entries,
  empty,
  readIds,
  onMarkRead,
}: {
  entries: ActivityEntry[];
  empty: string;
  readIds: string[];
  onMarkRead: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="px-1 py-8 text-center text-[13px] text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.slice(0, 20).map((entry) => {
        const read = readIds.includes(entry.id);
        return (
          <li
            key={entry.id}
            onClick={() => !read && onMarkRead(entry.id)}
            className={cn(
              "flex items-start gap-2.5 rounded-md px-1 py-1 text-[13px] transition-colors",
              !read && "bg-accent/30",
            )}
          >
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                toneMap[entry.kind],
                read && "opacity-40",
              )}
            />
            <span className={cn("min-w-0 flex-1", read && "text-muted-foreground")}>
              {entry.parts
                ? entry.parts.map((part, partIndex) => (
                    <span key={partIndex} className={read ? undefined : part.className}>
                      {part.text}
                    </span>
                  ))
                : entry.message}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatRelativeTime(entry.at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityMenu() {
  const activity = useNotificationStore((state) => state.activity);
  const readIds = useReadNotificationsStore((state) => state.readIds);
  const markRead = useReadNotificationsStore((state) => state.markRead);
  const markAllRead = useReadNotificationsStore((state) => state.markAllRead);
  const [tab, setTab] = useState<Tab>("activity");
  const narrow = useNarrowViewport();

  const online = useAuthStore((state) => state.mode === "wallet");
  const { logs: serverActivity } = useServerLogs("activity", online);
  const { logs: serverMarket } = useServerLogs("market", online);

  // Server logs are the source of truth when signed in with a wallet; the local
  // notification store keeps demo/offline play working.
  const activityEntries = useMemo<ActivityEntry[]>(
    () =>
      serverActivity.length
        ? serverActivity.map(toActivityEntry)
        : activity.filter((entry) => !isMarketEntry(entry)),
    [serverActivity, activity],
  );

  const marketEntries = useMemo<ActivityEntry[]>(() => {
    if (!serverMarket.length) return activity.filter(isMarketEntry);
    return serverMarket.map((log, index) => {
      const row = toMarketRow(log, index);
      return {
        id: row.id,
        message: marketLogMessage(row),
        kind: row.action === "sold" ? "success" : row.action === "cancelled" ? "danger" : "info",
        at: row.at,
      } satisfies ActivityEntry;
    });
  }, [serverMarket, activity]);

  const allIds = useMemo(
    () => [...activityEntries, ...marketEntries].map((entry) => entry.id),
    [activityEntries, marketEntries],
  );
  const unreadActivity = activityEntries.filter((e) => !readIds.includes(e.id)).length;
  const unreadMarket = marketEntries.filter((e) => !readIds.includes(e.id)).length;
  const unread = Math.min(unreadActivity + unreadMarket, 99);

  const tabs: { key: Tab; label: string; icon: typeof Mail; count: number }[] = [
    { key: "activity", label: "Activity", icon: Mail, count: unreadActivity },
    { key: "market", label: "Market", icon: Store, count: unreadMarket },
  ];

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Recent activity"
        className="relative shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus:outline-none"
      >
        <Mail className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold leading-4 text-primary-foreground">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={narrow ? "end" : "start"}
        side={narrow ? "bottom" : "right"}
        sideOffset={narrow ? 8 : 12}
        alignOffset={narrow ? 0 : -8}
        collisionPadding={12}
        avoidCollisions
        className="flex max-h-[70vh] w-[min(24rem,calc(100vw-1.5rem))] flex-col p-0 lg:max-h-[600px]"
      >
        <div className="shrink-0 border-b border-border px-4 pb-0 pt-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-semibold">Notifications</p>
              <p className="text-[11px] text-muted-foreground">Stay updated with your activity</p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead(allIds)}
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <CheckCheck className="size-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 flex">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 pb-2.5 text-[12px] font-medium transition-colors",
                  tab === key
                    ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:bg-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
                {count > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === "activity" ? (
            <EntryList
              entries={activityEntries}
              empty="Nothing yet. Claim HASH, open a chest, or run a raid."
              readIds={readIds}
              onMarkRead={markRead}
            />
          ) : (
            <EntryList
              entries={marketEntries}
              empty="No market activity yet."
              readIds={readIds}
              onMarkRead={markRead}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
