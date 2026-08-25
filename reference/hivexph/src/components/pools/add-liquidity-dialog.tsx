import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { execute as addLiquidity } from "@/lib/events/add-liquidity/action";
import { fetchTokenBalance } from "@/lib/fetchers/balances";
import type { Pool } from "@/lib/fetchers/pools";
import { cn } from "@/lib/utils";

function fmtNum(n: number, d = 8): string {
  if (!isFinite(n) || isNaN(n) || n === 0) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

export function AddLiquidityDialog({
  open,
  onOpenChange,
  pool,
  username,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pool: Pool;
  username: string;
}) {
  const [baseAmt, setBaseAmt] = useState("");
  const [quoteAmt, setQuoteAmt] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [editing, setEditing] = useState<"base" | "quote" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const baseQty = parseFloat(pool.baseQuantity) || 0;
  const quoteQty = parseFloat(pool.quoteQuantity) || 0;
  const ratio = baseQty > 0 ? quoteQty / baseQty : 0; // quote per 1 base

  const { data: baseBal } = useSWR(
    open && username ? ["bal", username, pool.base] : null,
    () => fetchTokenBalance(username, pool.base),
    { revalidateOnFocus: false },
  );
  const { data: quoteBal } = useSWR(
    open && username ? ["bal", username, pool.quote] : null,
    () => fetchTokenBalance(username, pool.quote),
    { revalidateOnFocus: false },
  );

  // Auto-sync the opposite field to maintain pool ratio
  useEffect(() => {
    if (editing !== "base" || ratio <= 0) return;
    const v = parseFloat(baseAmt);
    if (!isFinite(v) || v <= 0) {
      setQuoteAmt("");
      return;
    }
    setQuoteAmt((v * ratio).toFixed(8));
  }, [baseAmt, ratio, editing]);

  useEffect(() => {
    if (editing !== "quote" || ratio <= 0) return;
    const v = parseFloat(quoteAmt);
    if (!isFinite(v) || v <= 0) {
      setBaseAmt("");
      return;
    }
    setBaseAmt((v / ratio).toFixed(8));
  }, [quoteAmt, ratio, editing]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setBaseAmt("");
      setQuoteAmt("");
      setSlippage("1");
      setEditing(null);
    }
  }, [open]);

  const baseNum = parseFloat(baseAmt) || 0;
  const quoteNum = parseFloat(quoteAmt) || 0;
  const insufficientBase = baseNum > (baseBal ?? 0);
  const insufficientQuote = quoteNum > (quoteBal ?? 0);
  const canSubmit =
    !!username &&
    baseNum > 0 &&
    quoteNum > 0 &&
    !insufficientBase &&
    !insufficientQuote &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await addLiquidity({
        username,
        tokenPair: pool.tokenPair,
        baseQuantity: baseAmt,
        quoteQuantity: quoteAmt,
        maxPriceImpact: slippage || "1",
        maxDeviation: "0",
      });
      toast.success(`Add liquidity broadcast for ${pool.tokenPair}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add liquidity");
    } finally {
      setSubmitting(false);
    }
  };

  const inverse = ratio > 0 ? 1 / ratio : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-2xl border-border/60 bg-card p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="text-xl font-bold">Add Liquidity</h2>
          <DialogClose className="rounded-md text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex h-10 items-center rounded-lg border border-border/60 bg-background px-3 font-mono text-sm">
            {pool.tokenPair}
          </div>

          <TokenAmountBox
            symbol={pool.base}
            icon={pool.baseIcon}
            balance={baseBal ?? 0}
            value={baseAmt}
            onChange={(v) => {
              setEditing("base");
              setBaseAmt(v);
            }}
            insufficient={insufficientBase}
          />

          <TokenAmountBox
            symbol={pool.quote}
            icon={pool.quoteIcon}
            balance={quoteBal ?? 0}
            value={quoteAmt}
            onChange={(v) => {
              setEditing("quote");
              setQuoteAmt(v);
            }}
            insufficient={insufficientQuote}
          />

          <div className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
              <span>
                1 {pool.base} = {fmtNum(ratio, 8)} {pool.quote}
              </span>
              <span>
                1 {pool.quote} = {fmtNum(inverse, 8)} {pool.base}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-foreground">
                Maximum price impact tolerance
              </label>
              <div className="flex items-center rounded-md border border-border/60 bg-background pr-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="h-8 w-14 bg-transparent px-2 text-right font-mono text-sm focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Add Liquidity
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TokenAmountBox({
  symbol,
  icon,
  balance,
  value,
  onChange,
  insufficient,
}: {
  symbol: string;
  icon: string | null;
  balance: number;
  value: string;
  onChange: (v: string) => void;
  insufficient?: boolean;
}) {
  const initial = useMemo(() => symbol.slice(0, 2), [symbol]);
  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border bg-background/60 p-4",
        insufficient ? "border-destructive" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? (
            <img
              src={icon}
              alt={symbol}
              className="size-6 rounded-full object-contain"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] font-bold text-primary">
              {initial}
            </div>
          )}
          <span className="font-bold text-foreground">{symbol}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          Balance: {fmtNum(balance)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={() => onChange(String(balance))}
          className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
        >
          Max
        </button>
      </div>
      {insufficient && (
        <p className="font-mono text-[11px] text-destructive">
          Insufficient balance
        </p>
      )}
    </div>
  );
}
