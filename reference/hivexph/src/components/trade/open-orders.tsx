
import { useState, useCallback } from "react";
import { useApi, fetchOpenOrders, type OpenOrder } from "@/hooks/useAxios";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Cancel broadcast ──────────────────────────────────────────────────────────

function broadcastCancelOrder(
  username: string,
  side: "buy" | "sell",
  txId: string,   // Hive Engine cancel uses the txId string, not the numeric _id
  symbol: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.hive_keychain) {
      reject(new Error("Hive Keychain extension is not installed."));
      return;
    }
    // Hive Engine expects a JSON array of operations, key type Active
    const operations = JSON.stringify([
      {
        contractName: "market",
        contractAction: "cancel",
        contractPayload: {
          type: side,   // "buy" | "sell"
          id: txId,     // the txId from the order, not the numeric _id
        },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

// ── Component ─────────────────────────────────────────────────────────────────

export function OpenOrders({
  username,
  symbol,
}: {
  username: string;
  symbol: string;
}) {
  // Track in-flight cancels by txId (the id sent to the contract)
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  const {
    data,
    isLoading,
    mutate: refresh,
  } = useApi<{ orders: OpenOrder[] }>(
    [`open-orders-${username}-${symbol}`, () => fetchOpenOrders(username, symbol)],
    { refreshInterval: 15_000 },
  );

  const orders = data?.orders ?? [];

  const handleCancel = useCallback(
    async (order: OpenOrder) => {
      setCancelling((prev) => new Set(prev).add(order.txId));
      try {
        await broadcastCancelOrder(username, order.side, order.txId, symbol);
        toast.success(`${order.side === "buy" ? "Buy" : "Sell"} order cancelled.`);
        // Refresh after a short delay to let the chain process
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
    [username, symbol, refresh],
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            My Open Orders
          </span>
          {!isLoading && orders.length > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {orders.length}
            </Badge>
          )}
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

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
          No open orders for {symbol}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead>
              <tr className="border-b border-border/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Side</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Quantity</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Total (HIVE)</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Placed</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Expires in</th>
                <th className="px-4 py-2 text-center font-medium text-muted-foreground">Cancel</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const total = (
                  parseFloat(order.price) * parseFloat(order.quantity)
                ).toFixed(8);
                const isBuy = order.side === "buy";
                const isCancelling = cancelling.has(order.txId);

                return (
                  <tr
                    key={order._id}
                    className="border-b border-border/20 transition-colors hover:bg-accent/30"
                  >
                    {/* Side */}
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-semibold",
                          isBuy
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-rose-500/15 text-rose-400",
                        )}
                      >
                        {isBuy ? "BUY" : "SELL"}
                      </Badge>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">
                      {parseFloat(order.price).toFixed(8)}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">
                      {parseFloat(order.quantity).toFixed(8)}
                      <span className="ml-1 text-[10px] text-muted-foreground">{symbol}</span>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">
                      {total}
                      <span className="ml-1 text-[10px] text-muted-foreground">HIVE</span>
                    </td>

                    {/* Placed */}
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {fmtDate(order.timestamp)}
                    </td>

                    {/* Expiry */}
                    <td
                      className={cn(
                        "px-4 py-2.5",
                        fmtExpiry(order.expiration) === "Expired"
                          ? "text-rose-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {fmtExpiry(order.expiration)}
                    </td>

                    {/* Cancel */}
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:bg-rose-500/15 hover:text-rose-400"
                        disabled={isCancelling}
                        onClick={() => handleCancel(order)}
                        aria-label={`Cancel ${order.side} order for ${order.quantity} ${symbol}`}
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
      )}
    </div>
  );
}
