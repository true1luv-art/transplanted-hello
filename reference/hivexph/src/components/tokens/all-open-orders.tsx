
import { useState, useCallback } from "react";
import { useApi, fetchAllOpenOrders, type OpenOrder } from "@/hooks/useAxios";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RefreshCw, Link as LinkIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function broadcastCancelOrder(
  username: string,
  side: "buy" | "sell",
  txId: string,
  symbol: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.hive_keychain) {
      reject(new Error("Hive Keychain extension is not installed."));
      return;
    }
    const operations = JSON.stringify([
      {
        contractName: "market",
        contractAction: "cancel",
        contractPayload: { type: side, id: txId },
      },
    ]);
    window.hive_keychain!.requestCustomJson(
      username,
      "ssc-mainnet-hive",
      "Active",
      operations,
      `Cancel ${side === "buy" ? "Buy" : "Sell"} Order (${symbol})`,
      (res) => {
        if (res?.success) resolve();
        else reject(new Error(res?.message ?? "Cancelled by user."));
      },
    );
  });
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtExpiry(expiry: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = expiry - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function AllOpenOrders({
  username,
  isLoggedIn,
}: {
  username: string;
  isLoggedIn: boolean;
}) {
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  const { data, isLoading, mutate: refresh } = useApi<{ orders: OpenOrder[] }>(
    isLoggedIn ? [`all-open-orders-${username}`, () => fetchAllOpenOrders(username)] : null,
    { refreshInterval: 30_000 },
  );

  const orders = data?.orders ?? [];

  const handleCancel = useCallback(
    async (order: OpenOrder) => {
      setCancelling((prev) => new Set(prev).add(order.txId));
      try {
        await broadcastCancelOrder(username, order.side, order.txId, order.symbol);
        toast.success(`${order.side === "buy" ? "Buy" : "Sell"} order cancelled.`);
        setTimeout(() => refresh(), 3_000);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cancel failed.");
      } finally {
        setCancelling((prev) => {
          const next = new Set(prev);
          next.delete(order.txId);
          return next;
        });
      }
    },
    [username, refresh],
  );

  if (!isLoggedIn) {
    return (
      <div className="py-16 text-center font-mono text-[13px] text-muted-foreground">
        Sign in to view your open orders.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-16 text-center font-mono text-[13px] text-muted-foreground">
        No open orders yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            My Open Orders
          </span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {orders.length}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Refresh open orders"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead>
            <tr className="border-b border-border/40 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left">Token</th>
              <th className="px-4 py-2 text-left">Side</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2 text-right">Quantity</th>
              <th className="px-4 py-2 text-right">Total (HIVE)</th>
              <th className="px-4 py-2 text-left">Placed</th>
              <th className="px-4 py-2 text-left">Expires in</th>
              <th className="px-4 py-2 text-center">Cancel</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const total = (parseFloat(order.price) * parseFloat(order.quantity)).toFixed(8);
              const isBuy = order.side === "buy";
              const isCancelling = cancelling.has(order.txId);
              const expired = fmtExpiry(order.expiration) === "Expired";

              return (
                <tr key={`${order.side}-${order._id}`} className="border-b border-border/20 transition-colors hover:bg-accent/30">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/trade"
                      className="inline-flex items-center gap-1 font-mono font-semibold text-foreground hover:text-primary"
                    >
                      {order.symbol}
                      <LinkIcon className="size-3 opacity-60" />
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-semibold",
                        isBuy ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
                      )}
                    >
                      {isBuy ? "BUY" : "SELL"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">
                    {parseFloat(order.price).toFixed(8)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">
                    {parseFloat(order.quantity).toFixed(8)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{total}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(order.timestamp)}</td>
                  <td className={cn("px-4 py-2.5", expired ? "text-rose-400" : "text-muted-foreground")}>
                    {fmtExpiry(order.expiration)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:bg-rose-500/15 hover:text-rose-400"
                      disabled={isCancelling}
                      onClick={() => handleCancel(order)}
                      aria-label={`Cancel ${order.side} order for ${order.symbol}`}
                    >
                      {isCancelling ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <X className="size-3" />
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
