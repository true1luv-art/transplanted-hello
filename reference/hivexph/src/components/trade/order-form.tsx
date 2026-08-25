import { useState, useCallback, useEffect } from "react";
import { useApi, fetchSwapBalances, type TokenBalance } from "@/hooks/useAxios";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Broadcast helpers ─────────────────────────────────────────────────────────

function broadcastMarketOrder(
  username: string,
  action: "buy" | "sell",
  symbol: string,
  quantity: string,
  total: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.hive_keychain) {
      reject(new Error("Hive Keychain extension is not installed."));
      return;
    }
    const contractAction = action === "buy" ? "marketBuy" : "marketSell";
    const orderQuantity = action === "buy" ? total : quantity;
    const payload = {
      contractName: "market",
      contractAction,
      contractPayload: { symbol, quantity: orderQuantity },
    };
    window.hive_keychain!.requestCustomJson(
      username,
      "ssc-mainnet-hive",
      "Active",
      JSON.stringify(payload),
      `Market ${action === "buy" ? "Buy" : "Sell"} (${symbol})`,
      (res) => {
        if (res?.success) resolve();
        else reject(new Error(res?.message ?? "Order cancelled."));
      },
    );
  });
}

function broadcastLimitOrder(
  username: string,
  action: "buy" | "sell",
  symbol: string,
  price: string,
  quantity: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.hive_keychain) {
      reject(new Error("Hive Keychain extension is not installed."));
      return;
    }
    const payload = {
      contractName: "market",
      contractAction: action,
      contractPayload: { symbol, price, quantity },
    };
    window.hive_keychain!.requestCustomJson(
      username,
      "ssc-mainnet-hive",
      "Active",
      JSON.stringify(payload),
      `Limit ${action === "buy" ? "Buy" : "Sell"} (${symbol})`,
      (res) => {
        if (res?.success) resolve();
        else reject(new Error(res?.message ?? "Order cancelled."));
      },
    );
  });
}

function truncateToPrecision(value: number, precision: number): string {
  if (precision === 0) return Math.floor(value).toString();
  const factor = Math.pow(10, precision);
  return (Math.floor(value * factor) / factor).toFixed(precision);
}

function fmtDisplay(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  if (isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 8, minimumFractionDigits: 2 });
}

export function OrderForm({
  symbol,
  username,
  initialSide = "buy",
  initialPrice = "",
  precision,
}: {
  symbol: string;
  username: string | null;
  initialSide?: "buy" | "sell";
  initialPrice?: string;
  precision: number;
}) {
  const [side, setSide] = useState<"buy" | "sell">(initialSide);
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState(initialPrice);
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (initialPrice) setPrice(initialPrice); }, [initialPrice]);
  useEffect(() => { setSide(initialSide); }, [initialSide]);

  const { data: balances } = useApi<TokenBalance[]>(
    username ? [`swap-balances-${username}`, () => fetchSwapBalances(username)] : null,
    { refreshInterval: 30_000 },
  );
  const balMap = new Map((balances ?? []).map((b) => [b.symbol, b.balance]));
  const hiveBalance = parseFloat(balMap.get("SWAP.HIVE") ?? "0");
  const tokenBalance = parseFloat(balMap.get(symbol) ?? "0");

  const total =
    price && quantity && parseFloat(price) > 0 && parseFloat(quantity) > 0
      ? (parseFloat(price) * parseFloat(quantity)).toFixed(8)
      : "";

  const handleTotalChange = (val: string) => {
    if (!price || parseFloat(price) <= 0) return;
    const t = parseFloat(val);
    if (!isNaN(t) && t > 0) {
      setQuantity(truncateToPrecision(t / parseFloat(price), precision));
    } else {
      setQuantity("");
    }
  };

  const handleMax = useCallback(() => {
    if (side === "buy") {
      if (price && parseFloat(price) > 0 && hiveBalance > 0) {
        setQuantity(truncateToPrecision(hiveBalance / parseFloat(price), precision));
      }
    } else {
      if (tokenBalance > 0) setQuantity(truncateToPrecision(tokenBalance, precision));
    }
  }, [side, price, hiveBalance, tokenBalance, precision]);

  const handleSubmit = useCallback(async () => {
    if (!username) { toast.error("Please log in to place orders."); return; }
    const p = parseFloat(price);
    const rawQ = parseFloat(quantity);
    if (orderType === "limit" && (isNaN(p) || p <= 0)) { toast.error("Enter a valid price."); return; }
    if (isNaN(rawQ) || rawQ <= 0) { toast.error("Enter a valid quantity."); return; }

    const safeQty = truncateToPrecision(rawQ, precision);
    const safeQtyNum = parseFloat(safeQty);
    if (safeQtyNum <= 0) { toast.error(`Quantity too small for ${symbol} (precision: ${precision}).`); return; }
    const safeTotal = orderType === "limit" && !isNaN(p) && p > 0
      ? (safeQtyNum * p).toFixed(8)
      : total || "0";

    setSubmitting(true);
    try {
      if (orderType === "market") {
        await broadcastMarketOrder(username, side, symbol, safeQty, safeTotal);
      } else {
        await broadcastLimitOrder(username, side, symbol, price, safeQty);
      }
      toast.success(`${orderType === "limit" ? "Limit" : "Market"} ${side === "buy" ? "Buy" : "Sell"} order placed!`);
      setQuantity("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed.");
    } finally {
      setSubmitting(false);
    }
  }, [username, side, orderType, price, quantity, total, symbol, precision]);

  const isBuy = side === "buy";
  const btnColor = isBuy
    ? "bg-emerald-500 hover:bg-emerald-600 text-white"
    : "bg-rose-500 hover:bg-rose-600 text-white";
  const hiveNeeded = total ? parseFloat(total) : 0;
  const insufficient = isBuy
    ? hiveBalance > 0 && hiveNeeded > 0 && hiveNeeded > hiveBalance
    : tokenBalance > 0 && parseFloat(quantity || "0") > tokenBalance;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button type="button" onClick={() => setSide("buy")}
          className={cn("flex-1 py-2 text-[13px] font-semibold transition-colors",
            isBuy ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:bg-accent")}>
          Buy {symbol}
        </button>
        <button type="button" onClick={() => setSide("sell")}
          className={cn("flex-1 py-2 text-[13px] font-semibold transition-colors",
            !isBuy ? "bg-rose-500/20 text-rose-400" : "text-muted-foreground hover:bg-accent")}>
          Sell {symbol}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">Order Type</span>
        <div className="flex gap-1 rounded-md border border-border overflow-hidden">
          {(["limit", "market"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setOrderType(t)}
              className={cn("px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                orderType === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {orderType === "limit" && (
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-muted-foreground">Price</label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <input type="number" min="0" step="any" value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-mono text-foreground outline-none placeholder:text-muted-foreground" />
            <span className="text-[12px] font-semibold text-muted-foreground">HIVE</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[12px] text-muted-foreground">
            Quantity <span className="ml-1.5 text-[10px] text-muted-foreground/60">(precision: {precision})</span>
          </label>
          {username && (
            <button type="button" onClick={handleMax}
              className="text-[11px] font-semibold text-primary hover:text-primary/80">MAX</button>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <input type="number" min="0" step={precision > 0 ? `0.${"0".repeat(precision - 1)}1` : "1"}
            value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-mono text-foreground outline-none placeholder:text-muted-foreground" />
          <span className="text-[12px] font-semibold text-muted-foreground">{symbol}</span>
        </div>
      </div>

      {!(orderType === "market" && !isBuy) && (
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-muted-foreground">Total</label>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <input type="number" min="0" step="any" value={total}
              onChange={(e) => handleTotalChange(e.target.value)}
              readOnly={orderType === "market"} placeholder="0"
              className={cn("min-w-0 flex-1 bg-transparent text-[13px] font-mono text-foreground outline-none placeholder:text-muted-foreground",
                orderType === "market" && "cursor-default text-muted-foreground")} />
            <span className="text-[12px] font-semibold text-muted-foreground">HIVE</span>
          </div>
        </div>
      )}

      <button type="button" onClick={handleSubmit} disabled={submitting || !username}
        className={cn("mt-1 w-full rounded-md py-2.5 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50", btnColor)}>
        {submitting ? "Placing…" : isBuy ? `Buy ${symbol}` : `Sell ${symbol}`}
      </button>

      {username && (
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span><span className="font-mono text-foreground">{fmtDisplay(hiveBalance)}</span> SWAP.HIVE</span>
          <span><span className="font-mono text-foreground">{fmtDisplay(tokenBalance)}</span> {symbol}</span>
        </div>
      )}
      {insufficient && <p className="text-center text-[11px] text-rose-400">Insufficient balance</p>}
      {!username && <p className="text-center text-[11px] text-muted-foreground">Log in to trade</p>}
    </div>
  );
}
