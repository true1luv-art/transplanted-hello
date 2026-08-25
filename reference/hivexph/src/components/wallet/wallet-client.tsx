
import { useState, useMemo, useCallback } from "react";
import { useApi, fetchWallet, type WalletData, type WalletRow } from "@/hooks/useAxios";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { Link } from "@tanstack/react-router";
import Image from "@/components/next-image-shim";
import { Search, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, History, Send, X, Loader2, LockKeyhole, LockKeyholeOpen, ArrowRightLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { fetchPools, fetchLiquidityPositions, type Pool, type LiquidityPosition } from "@/lib/fetchers/pools";
import { getHiveAccount } from "@/lib/fetchers/hive-account-helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBalance(val: string, precision = 3): string {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)         return n.toLocaleString(undefined, { maximumFractionDigits: precision });
  return n.toFixed(Math.min(precision, 8));
}

function fmtUsd(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return "$0.00";
  if (n >= 1_000_000_000)  return "$" + (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000)      return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)          return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01)           return "$" + n.toFixed(2);
  return "$" + n.toFixed(6);
}

function pctColor(pct: string): string {
  const n = parseFloat(pct);
  if (n > 0)  return "text-emerald-400";
  if (n < 0)  return "text-red-400";
  return "text-muted-foreground";
}

type SortKey = "usdValue" | "balance" | "priceChangePercent";
type SortDir = "asc" | "desc";

function SortIcon({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  if (col !== active) return <ArrowUpDown className="size-3 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="size-3 text-primary" />
    : <ArrowDown className="size-3 text-primary" />;
}

// ── Token Icon ────────────────────────────────────────────────────────────────

function TokenIcon({ icon, symbol }: { icon: string | null; symbol: string }) {
  if (icon) {
    return (
      <div className="relative size-8 flex-shrink-0 overflow-hidden rounded-full">
        <Image
          src={icon}
          alt={symbol}
          fill
          unoptimized
          className="object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    );
  }
  return (
    <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
      {symbol.slice(0, 2)}
    </div>
  );
}

// ── Transfer Modal ────────────────────────────────────────────────────────────

interface TransferModalProps {
  username: string;
  symbol: string;
  precision: number;
  maxBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TransferModal({
  username,
  symbol,
  precision,
  maxBalance,
  onClose,
  onSuccess,
}: TransferModalProps) {
  const [to, setTo]         = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { transferHeTokens, transferHandler } = useHiveKeychain();
  const isLayer1 = symbol === "HIVE" || symbol === "HBD";

  const maxNum = parseFloat(maxBalance);

  function truncate(val: number): string {
    if (precision === 0) return Math.floor(val).toString();
    const factor = Math.pow(10, precision);
    return (Math.floor(val * factor) / factor).toFixed(precision);
  }

  const handleMax = () => setAmount(truncate(maxNum));

  const handleSubmit = useCallback(async () => {
    const toTrimmed = to.replace(/^@/, "").trim();
    if (!toTrimmed) { toast.error("Enter a recipient username."); return; }
    if (toTrimmed === username) { toast.error("Cannot transfer to yourself."); return; }

    const qty = parseFloat(amount);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter a valid amount."); return; }
    if (qty > maxNum) { toast.error(`Insufficient balance (max ${truncate(maxNum)} ${symbol}).`); return; }

    const safeQty = truncate(qty);

    setSubmitting(true);
    try {
      if (isLayer1) {
        await transferHandler(username, toTrimmed, qty, memo.trim(), symbol);
      } else {
        await transferHeTokens(username, toTrimmed, symbol, qty, precision, memo.trim());
      }
      toast.success(`Sent ${safeQty} ${symbol} to @${toTrimmed}.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  }, [username, to, amount, memo, symbol, maxNum, precision, isLayer1, transferHeTokens, transferHandler, onSuccess, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Send className="size-4 text-primary" />
            <h2 className="font-semibold text-foreground">Transfer {symbol}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Recipient */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">Recipient</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-primary/60">
              <span className="text-[13px] text-muted-foreground">@</span>
              <input
                type="text"
                placeholder="username"
                value={to.replace(/^@/, "")}
                onChange={(e) => setTo(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-muted-foreground">
                Amount
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">(precision: {precision})</span>
              </label>
              <button
                type="button"
                onClick={handleMax}
                disabled={maxNum <= 0}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-40"
              >
                MAX {truncate(maxNum)}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-primary/60">
              <input
                type="number"
                min="0"
                step={precision > 0 ? `0.${"0".repeat(precision - 1)}1` : "1"}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] font-semibold text-muted-foreground">{symbol}</span>
            </div>
          </div>

          {/* Memo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">
              Memo
              <span className="ml-1.5 text-[10px] text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Leave a note..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/60"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-border py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !to.trim() || !amount}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="size-3.5 animate-spin" /> Sending…</>
            ) : (
              <><Send className="size-3.5" /> Send</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stake Modal ───────────────────────────────────────────────────────────────

interface StakeModalProps {
  username: string;
  symbol: string;
  precision: number;
  maxBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}

function StakeModal({
  username,
  symbol,
  precision,
  maxBalance,
  onClose,
  onSuccess,
}: StakeModalProps) {
  const [to, setTo]         = useState(username);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { stakeHeTokens } = useHiveKeychain();

  const maxNum = parseFloat(maxBalance);

  function truncate(val: number): string {
    if (precision === 0) return Math.floor(val).toString();
    const factor = Math.pow(10, precision);
    return (Math.floor(val * factor) / factor).toFixed(precision);
  }

  const handleMax = () => setAmount(truncate(maxNum));

  const handleSubmit = useCallback(async () => {
    const toTrimmed = to.replace(/^@/, "").trim();
    if (!toTrimmed) { toast.error("Enter a recipient username."); return; }

    const qty = parseFloat(amount);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter a valid quantity."); return; }
    if (qty > maxNum) { toast.error(`Insufficient balance (max ${truncate(maxNum)} ${symbol}).`); return; }

    const safeQty = truncate(qty);

    setSubmitting(true);
    try {
      await stakeHeTokens(username, toTrimmed, symbol, safeQty);
      toast.success(`Staked ${safeQty} ${symbol} to @${toTrimmed}.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Staking failed.");
    } finally {
      setSubmitting(false);
    }
  }, [username, to, amount, symbol, maxNum, precision, stakeHeTokens, onSuccess, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <LockKeyhole className="size-4 text-primary" />
            <h2 className="font-semibold text-foreground">Stake {symbol}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Available */}
          <div className="rounded-md bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Available</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">
              {truncate(maxNum)} {symbol}
            </p>
          </div>

          {/* To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">To</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-primary/60">
              <span className="text-[13px] text-muted-foreground">@</span>
              <input
                type="text"
                placeholder="username"
                value={to.replace(/^@/, "")}
                onChange={(e) => setTo(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-muted-foreground">
                Quantity
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">(precision: {precision})</span>
              </label>
              <button
                type="button"
                onClick={handleMax}
                disabled={maxNum <= 0}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-40"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-primary/60">
              <input
                type="number"
                min="0"
                step={precision > 0 ? `0.${"0".repeat(precision - 1)}1` : "1"}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] font-semibold text-muted-foreground">{symbol}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-border py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !to.trim() || !amount}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="size-3.5 animate-spin" /> Staking…</>
            ) : (
              <><LockKeyhole className="size-3.5" /> Stake</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delegate Modal ────────────────────────────────────────────────────────��───

interface DelegateModalProps {
  username: string;
  symbol: string;
  precision: number;
  stakedBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}

function DelegateModal({
  username,
  symbol,
  precision,
  stakedBalance,
  onClose,
  onSuccess,
}: DelegateModalProps) {
  const [to, setTo]         = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { delegateHeTokens } = useHiveKeychain();

  const maxNum = parseFloat(stakedBalance);

  function truncate(val: number): string {
    if (precision === 0) return Math.floor(val).toString();
    const factor = Math.pow(10, precision);
    return (Math.floor(val * factor) / factor).toFixed(precision);
  }

  const handleMax = () => setAmount(truncate(maxNum));

  const handleSubmit = useCallback(async () => {
    const toTrimmed = to.replace(/^@/, "").trim();
    if (!toTrimmed) { toast.error("Enter a recipient username."); return; }
    if (toTrimmed === username) { toast.error("Cannot delegate to yourself."); return; }

    const qty = parseFloat(amount);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter a valid quantity."); return; }
    if (qty > maxNum) {
      toast.error(`Exceeds staked balance (max ${truncate(maxNum)} ${symbol}).`);
      return;
    }

    const safeQty = truncate(qty);

    setSubmitting(true);
    try {
      await delegateHeTokens(username, toTrimmed, symbol, safeQty);
      toast.success(`Delegated ${safeQty} ${symbol} to @${toTrimmed}.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delegation failed.");
    } finally {
      setSubmitting(false);
    }
  }, [username, to, amount, symbol, maxNum, precision, delegateHeTokens, onSuccess, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="size-4 text-sky-400" />
            <h2 className="font-semibold text-foreground">Delegate {symbol}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Available staked */}
          <div className="rounded-md bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Available (Staked)</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">
              {truncate(maxNum)} {symbol}
            </p>
          </div>

          {/* To */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-muted-foreground">To</label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-sky-400/60">
              <span className="text-[13px] text-muted-foreground">@</span>
              <input
                type="text"
                placeholder="username"
                value={to.replace(/^@/, "")}
                onChange={(e) => setTo(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-muted-foreground">
                Quantity
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">(precision: {precision})</span>
              </label>
              <button
                type="button"
                onClick={handleMax}
                disabled={maxNum <= 0}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-40"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-sky-400/60">
              <input
                type="number"
                min="0"
                step={precision > 0 ? `0.${"0".repeat(precision - 1)}1` : "1"}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] font-semibold text-muted-foreground">{symbol}</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            Delegation is sourced from your staked balance. You can undelegate at any time subject to a cooldown period.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-border py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !to.trim() || !amount}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-sky-500 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="size-3.5 animate-spin" /> Delegating…</>
            ) : (
              <><ArrowRightLeft className="size-3.5" /> Delegate</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unstake Modal ─────────────────────────────────────────────────────────────

interface UnstakeModalProps {
  username: string;
  symbol: string;
  precision: number;
  stakedBalance: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UnstakeModal({
  username,
  symbol,
  precision,
  stakedBalance,
  onClose,
  onSuccess,
}: UnstakeModalProps) {
  const [amount, setAmount]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { unstakeHeTokens } = useHiveKeychain();

  const maxNum = parseFloat(stakedBalance);

  function truncate(val: number): string {
    if (precision === 0) return Math.floor(val).toString();
    const factor = Math.pow(10, precision);
    return (Math.floor(val * factor) / factor).toFixed(precision);
  }

  const handleMax = () => setAmount(truncate(maxNum));

  const handleSubmit = useCallback(async () => {
    const qty = parseFloat(amount);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter a valid quantity."); return; }
    if (qty > maxNum) { toast.error(`Exceeds staked balance (max ${truncate(maxNum)} ${symbol}).`); return; }

    const safeQty = truncate(qty);

    setSubmitting(true);
    try {
      await unstakeHeTokens(username, symbol, safeQty);
      toast.success(`Unstaking ${safeQty} ${symbol}. Funds will be released after the cooldown period.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unstaking failed.");
    } finally {
      setSubmitting(false);
    }
  }, [username, amount, symbol, maxNum, precision, unstakeHeTokens, onSuccess, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <LockKeyholeOpen className="size-4 text-amber-400" />
            <h2 className="font-semibold text-foreground">Unstake {symbol}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Available staked */}
          <div className="rounded-md bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Available (Staked)</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">
              {truncate(maxNum)} {symbol}
            </p>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-muted-foreground">
                Quantity
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">(precision: {precision})</span>
              </label>
              <button
                type="button"
                onClick={handleMax}
                disabled={maxNum <= 0}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-40"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:border-amber-400/60">
              <input
                type="number"
                min="0"
                step={precision > 0 ? `0.${"0".repeat(precision - 1)}1` : "1"}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[12px] font-semibold text-muted-foreground">{symbol}</span>
            </div>
          </div>

          {/* Cooldown notice */}
          <p className="text-[11px] text-muted-foreground/70">
            Unstaked tokens are subject to a cooldown period before they become liquid.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-border py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !amount}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="size-3.5 animate-spin" /> Unstaking…</>
            ) : (
              <><LockKeyholeOpen className="size-3.5" /> Unstake</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── LP Positions ─────────────────────────────────────────────────────────────

function LPPositions({ username }: { username: string }) {
  const { data: positions, isLoading: posLoading, error: posError } = useApi<LiquidityPosition[]>(
    username ? [`lp-positions-${username}`, () => fetchLiquidityPositions(username)] : null,
    { refreshInterval: 60_000 },
  );
  const { data: pools, isLoading: poolsLoading } = useApi<Pool[]>(
    [`pools-all`, () => fetchPools()],
    { refreshInterval: 60_000 },
  );

  const rows = useMemo(() => {
    if (!positions || !pools) return [];
    const poolMap = new Map(pools.map((p) => [p.tokenPair, p]));
    return positions
      .map((pos) => {
        const pool = poolMap.get(pos.tokenPair);
        if (!pool) return { ...pos, pool: null, baseAmt: 0, quoteAmt: 0, usd: 0, sharePct: 0 };
        const shares = parseFloat(pos.shares) || 0;
        const total = parseFloat(pool.totalShares) || 0;
        const sharePct = total > 0 ? shares / total : 0;
        const baseAmt = (parseFloat(pool.baseQuantity) || 0) * sharePct;
        const quoteAmt = (parseFloat(pool.quoteQuantity) || 0) * sharePct;
        const tvl = parseFloat(pool.tvlUsd) || 0;
        const usd = tvl * sharePct;
        return { ...pos, pool, baseAmt, quoteAmt, usd, sharePct };
      })
      .sort((a, b) => b.usd - a.usd);
  }, [positions, pools]);

  const totalUsd = useMemo(() => rows.reduce((s, r) => s + r.usd, 0), [rows]);

  if (posLoading || poolsLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/20 py-16 text-center text-[13px] text-muted-foreground">
        <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
        Loading liquidity positions…
      </div>
    );
  }

  if (posError) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/20 py-16 text-center text-[13px] text-red-400">
        Failed to load LP positions.
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/20 py-16 text-center text-[13px] text-muted-foreground">
        No liquidity positions yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-4 py-3">
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground">Total LP Value</div>
        <div className="font-mono text-[15px] font-semibold text-foreground">{fmtUsd(totalUsd)}</div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60 bg-card/20">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/60 bg-card/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Pair</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Pooled</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Share</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tokenPair} className="border-b border-border/30 transition-colors hover:bg-accent/20">
                <td className="px-4 py-3">
                  <Link
                    to="/pool/$pair"
                    params={{ pair: r.tokenPair }}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {r.tokenPair}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {r.pool ? (
                    <div className="flex flex-col items-end gap-0.5 text-[12px]">
                      <span>{fmtBalance(r.baseAmt.toString(), 6)} {r.pool.base}</span>
                      <span className="text-muted-foreground">{fmtBalance(r.quoteAmt.toString(), 6)} {r.pool.quote}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                  {(r.sharePct * 100).toFixed(r.sharePct < 0.0001 ? 6 : 4)}%
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                  {fmtUsd(r.usd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WalletClient({ username, viewerUsername, tab, onTabChange }: { username: string; viewerUsername?: string; tab?: string; onTabChange?: (tab: string) => void }) {
  const isOwner = !!viewerUsername && viewerUsername.toLowerCase() === username.toLowerCase();
  const [search, setSearch]       = useState("");
  const [hideZero, setHideZero]   = useState(false);
  const [sortKey, setSortKey]     = useState<SortKey>("usdValue");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [transferTarget, setTransferTarget] = useState<WalletRow | null>(null);
  const [stakeTarget, setStakeTarget]         = useState<WalletRow | null>(null);
  const [unstakeTarget, setUnstakeTarget]     = useState<WalletRow | null>(null);
  const [delegateTarget, setDelegateTarget]   = useState<WalletRow | null>(null);
  // HIVE/HBD reuse the same `transferTarget` modal — see button handlers below.

  const { data, isLoading, error, mutate } = useApi<WalletData>(
    username ? [`wallet-${username}`, () => fetchWallet(username)] : null,
    { refreshInterval: 60_000 },
  );

  const { data: hiveAccount } = useApi(
    username ? [`hive-account-${username}`, () => getHiveAccount(username)] : null,
    { refreshInterval: 60_000 },
  );

  const hiveBalance = useMemo(
    () => parseFloat((hiveAccount?.balance ?? "0").split(" ")[0]) || 0,
    [hiveAccount],
  );
  const hbdBalance = useMemo(
    () => parseFloat((hiveAccount?.hbd_balance ?? "0").split(" ")[0]) || 0,
    [hiveAccount],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    let r = [...data.rows];

    if (hideZero) {
      r = r.filter((row) => parseFloat(row.balance) > 0 || parseFloat(row.stake) > 0);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(
        (row) => row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
      );
    }

    r.sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === "priceChangePercent") {
        aVal = parseFloat(a.priceChangePercent);
        bVal = parseFloat(b.priceChangePercent);
      } else {
        aVal = parseFloat(a[sortKey]);
        bVal = parseFloat(b[sortKey]);
      }
      if (isNaN(aVal)) aVal = 0;
      if (isNaN(bVal)) bVal = 0;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return r;
  }, [data, search, hideZero, sortKey, sortDir]);

  // ── Render ────────────────────────────────────────────────────────────────

  const totalUsd = parseFloat(data?.totalUsd ?? "0");
  const hivePriceUsd = data?.hivePriceUsd ?? 0;
  const layer1Usd = hiveBalance * hivePriceUsd + hbdBalance;
  const combinedUsd = totalUsd + layer1Usd;

  return (
    <>
    {transferTarget && (
      <TransferModal
        username={username}
        symbol={transferTarget.symbol}
        precision={transferTarget.precision}
        maxBalance={transferTarget.balance}
        onClose={() => setTransferTarget(null)}
        onSuccess={() => mutate()}
      />
    )}
    {stakeTarget && (
      <StakeModal
        username={username}
        symbol={stakeTarget.symbol}
        precision={stakeTarget.precision}
        maxBalance={stakeTarget.balance}
        onClose={() => setStakeTarget(null)}
        onSuccess={() => mutate()}
      />
    )}
    {unstakeTarget && (
      <UnstakeModal
        username={username}
        symbol={unstakeTarget.symbol}
        precision={unstakeTarget.precision}
        stakedBalance={unstakeTarget.stake}
        onClose={() => setUnstakeTarget(null)}
        onSuccess={() => mutate()}
      />
    )}
    {delegateTarget && (
      <DelegateModal
        username={username}
        symbol={delegateTarget.symbol}
        precision={delegateTarget.precision}
        stakedBalance={delegateTarget.stake}
        onClose={() => setDelegateTarget(null)}
        onSuccess={() => mutate()}
      />
    )}
    <div className="space-y-6">
      {/* Portfolio value header */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-5">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Estimated Portfolio Value
        </p>
        {isLoading ? (
          <div className="h-9 w-40 animate-pulse rounded bg-muted/30" />
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {fmtUsd(combinedUsd)}
            </p>
            {hivePriceUsd > 0 && (
              <p className="mb-0.5 font-mono text-[13px] text-muted-foreground">
                HIVE = {fmtUsd(hivePriceUsd)}
              </p>
            )}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-muted-foreground">
          <span>@{username}</span>
          {hiveAccount && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-foreground/80">
                  {hiveBalance.toLocaleString(undefined, { maximumFractionDigits: 3 })} HIVE
                </span>
                {isOwner && hiveBalance > 0 && (
                  <button
                    onClick={() => setTransferTarget({
                      symbol: "HIVE",
                      name: "Hive",
                      icon: null,
                      precision: 3,
                      balance: hiveBalance.toFixed(3),
                      stake: "0",
                      delegationsIn: "0",
                      delegationsOut: "0",
                      pendingUnstake: "0",
                      priceHive: "1",
                      priceUsd: hivePriceUsd.toFixed(8),
                      usdValue: (hiveBalance * hivePriceUsd).toFixed(4),
                      priceChangePercent: "0%",
                      stakingEnabled: false,
                      delegationEnabled: false,
                    })}
                    title="Transfer HIVE"
                    aria-label="Send HIVE"
                    className="flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <Send className="size-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-foreground/80">
                  {hbdBalance.toLocaleString(undefined, { maximumFractionDigits: 3 })} HBD
                </span>
                {isOwner && hbdBalance > 0 && (
                  <button
                    onClick={() => setTransferTarget({
                      symbol: "HBD",
                      name: "Hive Backed Dollars",
                      icon: null,
                      precision: 3,
                      balance: hbdBalance.toFixed(3),
                      stake: "0",
                      delegationsIn: "0",
                      delegationsOut: "0",
                      pendingUnstake: "0",
                      priceHive: "0",
                      priceUsd: "1",
                      usdValue: hbdBalance.toFixed(4),
                      priceChangePercent: "0%",
                      stakingEnabled: false,
                      delegationEnabled: false,
                    })}
                    title="Transfer HBD"
                    aria-label="Send HBD"
                    className="flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <Send className="size-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <Tabs value={tab ?? "tokens"} onValueChange={onTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="lps">LPs</TabsTrigger>
          <TabsTrigger value="nfts">NFTs</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => setHideZero(e.target.checked)}
            className="rounded border-border accent-primary"
          />
          Hide zero balances
        </label>
        <span className="ml-auto font-mono text-[12px] text-muted-foreground">
          {isLoading ? "Loading…" : `${rows.length.toLocaleString()} tokens`}
        </span>
          </div>

      {/* Table */}
      {error ? (
        <p className="py-12 text-center text-[13px] text-destructive">
          Failed to load wallet. Please try again.
        </p>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/60 bg-card/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    Token
                  </th>
                  <th
                    className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("balance")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Balance
                      <SortIcon col="balance" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("usdValue")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      USD Value
                      <SortIcon col="usdValue" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort("priceChangePercent")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      % Change
                      <SortIcon col="priceChangePercent" active={sortKey} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    Stake
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    Delegation
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 12 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="size-8 animate-pulse rounded-full bg-muted/30" />
                            <div className="space-y-1">
                              <div className="h-3 w-16 animate-pulse rounded bg-muted/30" />
                              <div className="h-2.5 w-24 animate-pulse rounded bg-muted/20" />
                            </div>
                          </div>
                        </td>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted/30" />
                          </td>
                        ))}
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : rows.map((row) => {
                      const bal     = parseFloat(row.balance);
                      const stk     = parseFloat(row.stake);
                      const delIn   = parseFloat(row.delegationsIn);
                      const delOut  = parseFloat(row.delegationsOut);
                      const hasActivity = bal > 0 || stk > 0 || delIn > 0 || delOut > 0;

                      return (
                        <tr
                          key={row.symbol}
                          className={cn(
                            "border-b border-border/30 transition-colors hover:bg-accent/20",
                            !hasActivity && "opacity-50",
                          )}
                        >
                          {/* Token */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <TokenIcon icon={row.icon} symbol={row.symbol} />
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground">{row.symbol}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
                              </div>
                            </div>
                          </td>

                          {/* Balance */}
                          <td className="px-4 py-3 text-right">
                            <p className="font-mono text-foreground">{fmtBalance(row.balance, row.precision)}</p>
                            {parseFloat(row.priceUsd) > 0 && (
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {fmtUsd(row.priceUsd)} / token
                              </p>
                            )}
                          </td>

                          {/* USD Value */}
                          <td className="px-4 py-3 text-right">
                            <p className={cn("font-mono font-medium", parseFloat(row.usdValue) > 0 ? "text-foreground" : "text-muted-foreground")}>
                              {fmtUsd(row.usdValue)}
                            </p>
                          </td>

                          {/* % Change */}
                          <td className={cn("px-4 py-3 text-right font-mono font-medium", pctColor(row.priceChangePercent))}>
                            {row.priceChangePercent === "0%" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              row.priceChangePercent
                            )}
                          </td>

                          {/* Stake */}
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {stk > 0 ? fmtBalance(row.stake, row.precision) : "—"}
                          </td>

                          {/* Delegation (In - Out) */}
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {delIn > 0 || delOut > 0 ? (
                              <span>
                                {delIn > 0 && <span className="text-emerald-400/80">+{fmtBalance(row.delegationsIn, row.precision)}</span>}
                                {delOut > 0 && <span className="text-red-400/80 ml-1">-{fmtBalance(row.delegationsOut, row.precision)}</span>}
                              </span>
                            ) : "—"}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {/* History — visible to everyone */}
                              <Link
                                to={`/wallet/${username}/${row.symbol}`}
                                title={`View ${row.symbol} history`}
                                className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                              >
                                <History className="size-3.5" />
                              </Link>

                              {/* Owner-only actions */}
                              {isOwner && (
                                <>
                                  <Link
                                    to={`/trade?symbol=${row.symbol}`}
                                    title={`Trade ${row.symbol}`}
                                    className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                                  >
                                    <TrendingUp className="size-3.5" />
                                  </Link>
                                  <button
                                    onClick={() => setTransferTarget(row)}
                                    title={`Transfer ${row.symbol}`}
                                    className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                                  >
                                    <Send className="size-3.5" />
                                  </button>
                                  {row.stakingEnabled && (
                                    <button
                                      onClick={() => setStakeTarget(row)}
                                      title={`Stake ${row.symbol}`}
                                      className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                                    >
                                      <LockKeyhole className="size-3.5" />
                                    </button>
                                  )}
                                  {row.stakingEnabled && parseFloat(row.stake) > 0 && (
                                    <button
                                      onClick={() => setUnstakeTarget(row)}
                                      title={`Unstake ${row.symbol}`}
                                      className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
                                    >
                                      <LockKeyholeOpen className="size-3.5" />
                                    </button>
                                  )}
                                  {row.delegationEnabled && parseFloat(row.stake) > 0 && (
                                    <button
                                      onClick={() => setDelegateTarget(row)}
                                      title={`Delegate ${row.symbol}`}
                                      className="flex size-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-400"
                                    >
                                      <ArrowRightLeft className="size-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[13px] text-muted-foreground">
                      {search ? "No tokens match your search." : "No token balances found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="lps">
          <LPPositions username={username} />
        </TabsContent>

        <TabsContent value="nfts">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card/20 py-20 text-center">
            <Clock className="size-8 text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium text-foreground">Coming Soon</p>
            <p className="mt-1 text-[13px] text-muted-foreground">NFT support is on the way.</p>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <TransactionsClient username={username} />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
