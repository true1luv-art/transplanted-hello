import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, CheckCheck, ChevronRight, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Tab = "inbox" | "announcements";

export interface WhatsNewItem {
  id: string;
  title: string;
  body: string;
  when: Date;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  when: Date;
  read: boolean;
}

function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface NotificationsBellProps {
  notifications?: NotificationItem[];
  whatsNew?: WhatsNewItem[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  username?: string;
}

export function NotificationsBell({
  notifications = [],
  whatsNew = [],
  onMarkAsRead,
  onMarkAllAsRead,
  username,
}: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("inbox");
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Notifications"
        className={cn(
          "relative flex size-7 flex-shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none",
          open && "bg-accent text-foreground",
        )}
      >
        <Mail className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        alignOffset={-8}
        collisionPadding={8}
        className="w-[calc(100vw-1rem)] max-w-sm sm:w-96 max-h-[80vh] sm:max-h-[600px] p-0 flex flex-col"
      >
        <div className="border-b px-4 pb-0 pt-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                Stay updated with your activity
              </p>
            </div>
            {tab === "inbox" && notifications.length > 0 && onMarkAllAsRead && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <CheckCheck className="size-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 flex">
            {(
              [
                { key: "inbox", label: "Transactions", count: unreadCount },
                { key: "announcements", label: "Announcements", count: 0 },
              ] as { key: Tab; label: string; count: number }[]
            ).map(({ key, label, count }) => (
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
                {label}
                {count > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {tab === "inbox" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Mail className="size-8 text-muted-foreground/40" />
                <p className="text-[13px] text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto divide-y">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3",
                      !n.read && "bg-accent/30",
                    )}
                  >
                    <div className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Mail className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-foreground">{n.title}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatWhen(n.when)}</p>
                    </div>
                    {!n.read && onMarkAsRead && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(n.id)}
                        aria-label="Mark as read"
                        className="mt-0.5 flex-shrink-0 rounded-sm p-0.5 text-muted-foreground/50 transition hover:bg-accent hover:text-foreground"
                      >
                        <CheckCheck className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {notifications.length > 0 && (
              <div className="border-t px-4 py-2.5 flex-shrink-0">
                <p className="text-[11px] text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} unread · ${notifications.length} total`
                    : `${notifications.length} notifications`}
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "announcements" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {whatsNew.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Megaphone className="size-8 text-muted-foreground/40" />
                <p className="text-[13px] text-muted-foreground">No announcements yet</p>
              </div>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto divide-y">
                {whatsNew.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Megaphone className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{item.body}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatWhen(item.when)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="border-t flex-shrink-0">
          {tab === "inbox" ? (
            username ? (
              <Link
                to="/wallet/$username"
                params={{ username }}
                search={{ tab: "history" }}
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                See all transactions
                <ChevronRight className="size-3.5" />
              </Link>
            ) : null
          ) : (
            <Link
              to="/announcements"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              See all announcements
              <ChevronRight className="size-3.5" />
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
