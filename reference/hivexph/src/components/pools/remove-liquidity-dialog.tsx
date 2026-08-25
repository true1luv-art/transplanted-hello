import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { execute as removeLiquidity } from "@/lib/events/remove-liquidity/action";
import type { Pool } from "@/lib/fetchers/pools";

function fmtNum(n: number, d = 8): string {
  if (!isFinite(n) || isNaN(n) || n === 0) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

export function RemoveLiquidityDialog({
  open,
  onOpenChange,
  pool,
  username,
  myShares,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pool: Pool;
  username: string;
  myShares: number;
}) {
  const [pct, setPct] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPct(50);
    }
  }, [open]);

  const totalShares = parseFloat(pool.totalShares) || 0;
  const baseQty = parseFloat(pool.baseQuantity) || 0;
  const quoteQty = parseFloat(pool.quoteQuantity) || 0;
  const myFraction = totalShares > 0 ? myShares / totalShares : 0;

  const baseOut = baseQty * myFraction * (pct / 100);
  const quoteOut = quoteQty * myFraction * (pct / 100);

  const canSubmit = !!username && myShares > 0 && pct > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await removeLiquidity({
        username,
        tokenPair: pool.tokenPair,
        sharesOut: String(pct),
      });
      toast.success(`Remove liquidity broadcast for ${pool.tokenPair}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove liquidity");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-2xl border-border/60 bg-card p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="text-xl font-bold">Remove Liquidity</h2>
          <DialogClose className="rounded-md text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </DialogClose>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex h-10 items-center rounded-lg border border-border/60 bg-background px-3 font-mono text-sm">
            {pool.tokenPair}
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Withdraw Percent</span>
              <div className="flex items-center rounded-md border border-border/60 bg-background pr-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={pct}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(100, Number(e.target.value) || 0));
                    setPct(v);
                  }}
                  className="h-8 w-14 bg-transparent px-2 text-right font-mono text-sm focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="font-bold text-foreground">Estimated Amount Out</p>
            <AmountOut symbol={pool.base} icon={pool.baseIcon} amount={baseOut} />
            <AmountOut symbol={pool.quote} icon={pool.quoteIcon} amount={quoteOut} />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Remove Liquidity
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AmountOut({
  symbol,
  icon,
  amount,
}: {
  symbol: string;
  icon: string | null;
  amount: number;
}) {
  return (
    <div className="flex h-10 items-center justify-between rounded-lg border border-border/60 bg-background px-3 font-mono text-sm">
      <span className="text-foreground">{fmtNum(amount)}</span>
      <div className="flex items-center gap-2">
        {icon ? (
          <img
            src={icon}
            alt={symbol}
            className="size-5 rounded-full object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex size-5 items-center justify-center rounded-full bg-primary/20 font-mono text-[9px] font-bold text-primary">
            {symbol.slice(0, 2)}
          </div>
        )}
        <span className="font-bold text-foreground">{symbol}</span>
      </div>
    </div>
  );
}
