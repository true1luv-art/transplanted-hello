
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
import { useApi, fetchSwapTokens, fetchSwapBalances, fetchSwapQuote, type SwapToken, type TokenBalance, type SwapQuote } from "@/hooks/useAxios";
import {
  Search,
  ArrowDownUp,
  ChevronDown,
  Info,
  AlertTriangle,
  RefreshCw,
  Settings2,
  Check,
  Users,
  Copy,
  Star,
  Shuffle,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchPoolLiquidityPositions, fetchPools, type LiquidityPosition, type Pool } from "@/lib/fetchers/pools";

// ── Types ─────────────────────────────────────────────────────────────────────



const SLIPPAGE_OPTIONS = [0.5, 1, 2] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNumber(n: number | string, decimals = 6): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0";
  if (num === 0) return "0";
  if (num < 0.000001) return num.toExponential(2);
  return num.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

function fmtCompact(n: number, decimals = 2): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(decimals)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtUsd(n: number): string {
  if (!isFinite(n) || isNaN(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(2)}`;
}

function impactColor(impact: number): string {
  if (impact < 1) return "text-success";
  if (impact < 3) return "text-warning";
  return "text-destructive";
}

// ── TokenIcon ─────────────────────────────────────────────────────────────────

function TokenIcon({ icon, symbol, size = 24 }: { icon: string | null; symbol: string; size?: number }) {
  const [imgErr, setImgErr] = useState(false);

  if (icon && !imgErr) {
    return (
      <img
        src={icon}
        alt={symbol}
        width={size}
        height={size}
        crossOrigin="anonymous"
        onError={() => setImgErr(true)}
        className="flex-shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback: letter avatar
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}

// ── TokenSelector modal ───────────────────────────────────────────────────────

function TokenSelector({
  tokens,
  loading,
  selected,
  onSelect,
  balances,
  exclude,
}: {
  tokens: SwapToken[];
  loading: boolean;
  selected: SwapToken | null;
  onSelect: (t: SwapToken) => void;
  balances: Map<string, string>;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = tokens.filter(
    (t) =>
      t.symbol !== exclude &&
      (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none"
      >
        {selected ? (
          <>
            <TokenIcon icon={selected.icon} symbol={selected.symbol} size={20} />
            <span className="font-mono">{selected.symbol}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select token</span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[300px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="size-3.5 flex-shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="size-6 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="mb-1 h-3 w-20" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                No tokens found
              </p>
            ) : (
              filtered.map((t) => {
                const bal = balances.get(t.symbol) ?? "0";
                const balNum = parseFloat(bal);
                return (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                      selected?.symbol === t.symbol && "bg-primary/10"
                    )}
                  >
                    <TokenIcon icon={t.icon} symbol={t.symbol} size={22} />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-semibold text-foreground">{t.symbol}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{t.name}</p>
                    </div>
                    {balNum > 0 && (
                      <span className="flex-shrink-0 font-mono text-[12px] text-foreground">
                        {fmtNumber(balNum, 4)}
                      </span>
                    )}
                    {selected?.symbol === t.symbol && (
                      <Check className="size-3.5 flex-shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SlippageSettings ──────────────────────────────────────────────────────────

function SlippageSettings({
  slippage,
  onSlippageChange,
}: {
  slippage: number;
  onSlippageChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isPreset = SLIPPAGE_OPTIONS.includes(slippage as (typeof SLIPPAGE_OPTIONS)[number]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none"
        aria-label="Slippage settings"
      >
        <Settings2 className="size-3.5" />
        Slippage: {slippage}%
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[220px] rounded-xl border border-border bg-popover p-3 shadow-xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Slippage Tolerance
          </p>
          <div className="flex gap-1.5">
            {SLIPPAGE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onSlippageChange(s);
                  setCustom("");
                }}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition-colors",
                  slippage === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {s}%
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) onSlippageChange(v);
              }}
              placeholder="Custom %"
              className={cn(
                "h-7 w-full rounded-lg border bg-background px-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                !isPreset && "border-primary ring-1 ring-primary"
              )}
            />
          </div>
          {slippage > 5 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="size-3" />
              High slippage — proceed with caution
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── TokenAmountInput ──────────────────────────────────────────────────────────

function TokenAmountInput({
  label,
  token,
  tokens,
  loading,
  amount,
  onAmountChange,
  readonly,
  onTokenSelect,
  balances,
  excludeSymbol,
  onMaxClick,
  usdValue,
}: {
  label: string;
  token: SwapToken | null;
  tokens: SwapToken[];
  loading: boolean;
  amount: string;
  onAmountChange?: (v: string) => void;
  readonly?: boolean;
  onTokenSelect: (t: SwapToken) => void;
  balances: Map<string, string>;
  excludeSymbol?: string;
  onMaxClick?: () => void;
  usdValue?: string | null;
}) {
  const balance = token ? parseFloat(balances.get(token.symbol) ?? "0") : 0;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 transition-colors focus-within:border-primary/60">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        {token && (
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span>Balance: {fmtNumber(balance, 6)}</span>
            {onMaxClick && balance > 0 && (
              <button
                type="button"
                onClick={onMaxClick}
                className="rounded px-1 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
            readOnly={readonly}
            placeholder="0.00"
            className={cn(
              "w-full bg-transparent text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40",
              readonly && "cursor-default select-none text-muted-foreground"
            )}
          />
          {usdValue && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{usdValue}</p>
          )}
        </div>
        <TokenSelector
          tokens={tokens}
          loading={loading}
          selected={token}
          onSelect={onTokenSelect}
          balances={balances}
          exclude={excludeSymbol}
        />
      </div>
    </div>
  );
}

// ── RouteInfo ─────────────────────────────────────────────────────────────────

function RouteInfo({ quote, slippage }: { quote: SwapQuote; slippage: number }) {
  const [open, setOpen] = useState(false);

  if (!quote.poolFound || quote.amountOut === 0) return null;

  const minReceived = quote.amountOut * (1 - slippage / 100);

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent/40"
      >
        <span className="font-medium">
          1 {quote.tokenIn} ≈ {fmtNumber(quote.spotPrice, 8)} {quote.tokenOut}
        </span>
        <div className="flex items-center gap-1.5">
          <Info className="size-3" />
          <span>{open ? "Hide" : "Details"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={cn("font-mono font-medium", impactColor(quote.priceImpact))}>
                {quote.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Swap Fee ({quote.feePercent ?? 0.25}%)
                {quote.path.length > 2 ? " ×2 hops" : ""}
              </span>
              <span className="font-mono text-foreground">
                {fmtNumber(quote.fee, 6)} {quote.tokenIn}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Min. Received ({slippage}% slippage)</span>
              <span className="font-mono font-medium text-foreground">
                {fmtNumber(minReceived, 6)} {quote.tokenOut}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Route</span>
              <span className="font-mono text-foreground">
                {quote.path.join(" → ")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pool Reserve ({quote.tokenIn})</span>
              <span className="font-mono text-foreground">{fmtNumber(quote.reserveIn, 2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main SwapClient component ─────────────────────────────────────────────────

export function SwapClient({ username }: { username: string | null }) {
  const [tokenIn, setTokenIn] = useState<SwapToken | null>(null);
  const [tokenOut, setTokenOut] = useState<SwapToken | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [swapping, setSwapping] = useState(false);

  // Fetch token list
  const { data: tokens, isLoading: tokensLoading } = useApi<SwapToken[]>(
    ['swap-tokens', fetchSwapTokens],
    { refreshInterval: 120_000 }
  );

  // Set defaults once tokens load
  useEffect(() => {
    if (!tokens || tokens.length === 0) return;
    if (!tokenIn) {
      const swapHive = tokens.find((t) => t.symbol === "SWAP.HIVE");
      setTokenIn(swapHive ?? tokens[0]);
    }
    if (!tokenOut) {
      const bee = tokens.find((t) => t.symbol === "BEE");
      setTokenOut(bee ?? tokens[1] ?? null);
    }
  }, [tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user balances
  const { data: rawBalances, mutate: refreshBalances } = useApi<TokenBalance[]>(
    username ? [`swap-balances-${username}`, () => fetchSwapBalances(username)] : null,
    { refreshInterval: 30_000 }
  );

  const balances = new Map<string, string>(
    (rawBalances ?? []).map((b) => [b.symbol, b.balance])
  );

  // HIVE/USD price is now included in the swap quote result; fetch separately only for display
  const hivePriceUsd = 0;

  // Quote — debounced
  const [debouncedAmount, setDebouncedAmount] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(amountIn), 500);
    return () => clearTimeout(t);
  }, [amountIn]);

  const quoteEnabled =
    tokenIn && tokenOut && debouncedAmount && parseFloat(debouncedAmount) > 0;

  const {
    data: quote,
    isLoading: quoteLoading,
    mutate: refreshQuote,
  } = useApi<SwapQuote>(
    quoteEnabled
      ? [`swap-quote-${tokenIn!.symbol}-${tokenOut!.symbol}-${debouncedAmount}`, () => fetchSwapQuote(tokenIn!.symbol, tokenOut!.symbol, parseFloat(debouncedAmount))]
      : null,
    { refreshInterval: 15_000, keepPreviousData: false },
  );

  // Swap tokens
  const handleSwapSides = useCallback(() => {
    const prevIn = tokenIn;
    const prevOut = tokenOut;
    // Use the estimated output as the new input amount, formatted to 8 decimals
    const prevAmt = quote?.amountOut != null && quote.amountOut > 0
      ? quote.amountOut.toFixed(8)
      : "";
    setTokenIn(prevOut);
    setTokenOut(prevIn);
    setAmountIn(prevAmt);
  }, [tokenIn, tokenOut, quote]);

  // MAX button
  const handleMax = useCallback(() => {
    if (!tokenIn) return;
    const bal = balances.get(tokenIn.symbol) ?? "0";
    setAmountIn(bal);
  }, [tokenIn, balances]);

  // ── Hive Keychain broadcast helper ──────────────────────────────────────────
  // Wraps requestCustomJson in a Promise so we can await it cleanly.
  const broadcastSwap = useCallback(
    (
      tokenSymbol: string,
      tokenPair: string,
      tokenAmount: string,
      minAmountOut: string,
      memo: string
    ): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        if (!window.hive_keychain) {
          reject(new Error("Hive Keychain extension is not installed."));
          return;
        }
        // Exact contract payload structure per Hive Engine marketpools spec:
        // contractName, contractAction, contractPayload (tokenPair, tokenSymbol,
        // tokenAmount, tradeType, minAmountOut, isSignedWithActiveKey)
        const payload = {
          contractName: "marketpools",
          contractAction: "swapTokens",
          contractPayload: {
            tokenPair,
            tokenSymbol,
            tokenAmount,
            tradeType: "exactInput",
            minAmountOut,
            isSignedWithActiveKey: true,
          },
        };
        window.hive_keychain!.requestCustomJson(
          username!,
          "ssc-mainnet-hive",
          "Active",
          JSON.stringify(payload),
          memo,
          (res) => {
            if (res?.success) resolve();
            else reject(new Error(res?.message ?? "Swap cancelled."));
          }
        );
      });
    },
    [username]
  );

  // Execute swap via Hive Keychain
  const handleSwap = useCallback(async () => {
    if (!username) {
      toast.error("Please sign in to swap tokens.");
      return;
    }
    if (!tokenIn || !tokenOut || !quote || !quote.poolFound) {
      toast.error("No liquidity pool found for this pair.");
      return;
    }
    if (!window.hive_keychain) {
      toast.error("Hive Keychain extension is not installed.");
      return;
    }
    if (parseFloat(amountIn) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    // minAmountOut = amountOut reduced by slippage tolerance, 8 decimal string
    const minReceived = quote.amountOut * (1 - slippage / 100);

    setSwapping(true);
    try {
      const isMultiHop = quote.path.length > 2;

      if (!isMultiHop) {
        // ── Single-hop swap ────────────────────────────────────────────────
        // Use the exact tokenPair key returned by the contract (e.g. "SWAP.HIVE:SCRAP"),
        // never re-sort on the client — pool keys are determined by Hive Engine.
        const tokenAmount = parseFloat(amountIn).toFixed(8);
        const minAmountOutStr = minReceived.toFixed(8);

        await broadcastSwap(
          tokenIn.symbol,
          quote.poolId,
          tokenAmount,
          minAmountOutStr,
          `Swap ${amountIn} ${tokenIn.symbol} for ≥${fmtNumber(minReceived, 6)} ${tokenOut.symbol}`
        );
      } else {
        // ── 2-hop swap via bridge token (e.g. SWAP.HIVE) ────────��─────────
        // Hive Engine processes one pool per contractAction, so we broadcast
        // two sequential requestCustomJson calls.
        const bridge = quote.path[1]; // e.g. "SWAP.HIVE"

        // Hop 1: tokenIn → bridge — use the exact pool key from the quote
        const amount1 = parseFloat(amountIn).toFixed(8);
        // Allow any output on hop 1; slippage is enforced on the final leg
        const minOut1 = (0).toFixed(8);

        toast.info(`Step 1/2: Swapping ${tokenIn.symbol} → ${bridge}…`);
        await broadcastSwap(
          tokenIn.symbol,
          quote.poolId,
          amount1,
          minOut1,
          `[1/2] Swap ${amountIn} ${tokenIn.symbol} → ${bridge}`
        );

        // Hop 2: bridge → tokenOut
        // Use the exact pool key from the quote for hop 2 (quote.poolId2).
        // Estimate the mid-step output using the same AMM constant-product formula
        // (x * feeMul * reserveOut) / (reserveIn + x * feeMul), then use it as
        // the tokenAmount for hop 2. Apply slippage only to the final minAmountOut.
        const feeMul = 1 - quote.feePercent / 100;
        const amtInNum = parseFloat(amountIn);
        const midAmtWithFee = amtInNum * feeMul;
        const midAmount =
          quote.reserveIn > 0
            ? (midAmtWithFee * (quote.reserveIn * quote.spotPrice)) /
              (quote.reserveIn + midAmtWithFee)
            : 0;
        const amount2 = midAmount > 0 ? midAmount.toFixed(8) : amtInNum.toFixed(8);
        const minOut2 = minReceived.toFixed(8);

        toast.info(`Step 2/2: Swapping ${bridge} → ${tokenOut.symbol}…`);
        await broadcastSwap(
          bridge,
          quote.poolId2,
          amount2,
          minOut2,
          `[2/2] Swap ${bridge} → ${tokenOut.symbol}, min ${fmtNumber(minReceived, 6)}`
        );
      }

      toast.success(
        `Swap submitted! You should receive ~${fmtNumber(quote.amountOut, 6)} ${tokenOut.symbol}`
      );
      setAmountIn("");
      refreshBalances();
      refreshQuote();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Swap failed.";
      toast.error(msg);
    } finally {
      setSwapping(false);
    }
  }, [username, tokenIn, tokenOut, quote, amountIn, slippage, broadcastSwap, refreshBalances, refreshQuote]);

  const noPool = quote && !quote.poolFound;
  const insufficientBalance =
    tokenIn && parseFloat(amountIn) > parseFloat(balances.get(tokenIn.symbol) ?? "0");

  const canSwap =
    !!username &&
    !!tokenIn &&
    !!tokenOut &&
    parseFloat(amountIn) > 0 &&
    quote?.poolFound &&
    !insufficientBalance &&
    !swapping &&
    !quoteLoading;

  // Use toFixed(8) — NOT fmtNumber — because fmtNumber uses toLocaleString which
  // adds thousands commas (e.g. "1,439.84") and type="number" inputs reject those,
  // causing the field to display blank (0.00 placeholder) even when amountOut > 0.
  const outputAmount =
    quote && quote.poolFound && quote.amountOut > 0
      ? quote.amountOut.toFixed(8)
      : "";

  // USD value helpers using spot price from the quote
  // tokenIn is quoted in HIVE via spotPrice (tokenIn/tokenOut), so we compute
  // amountIn in HIVE then multiply by hivePriceUsd.
  function fmtUsdValue(amtStr: string, inHive: boolean): string | null {
    const amt = parseFloat(amtStr);
    if (!hivePriceUsd || isNaN(amt) || amt <= 0) return null;
    let hiveAmt: number;
    if (inHive) {
      hiveAmt = amt;
    } else if (quote?.spotPrice && quote.spotPrice > 0) {
      // spotPrice = tokenOut per tokenIn, so tokenIn → tokenOut → HIVE
      // For the "From" side we need HIVE value: if tokenIn is SWAP.HIVE, 1:1
      // Otherwise use reserveIn/reserveOut to approximate HIVE value.
      hiveAmt = amt * quote.spotPrice;
    } else {
      return null;
    }
    const usd = hiveAmt * hivePriceUsd;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (usd >= 0.01) return `$${usd.toFixed(2)}`;
    return `$${usd.toFixed(6)}`;
  }

  const usdIn = tokenIn?.symbol === "SWAP.HIVE"
    ? fmtUsdValue(amountIn, true)
    : fmtUsdValue(amountIn, false);
  const usdOut = tokenOut?.symbol === "SWAP.HIVE"
    ? fmtUsdValue(outputAmount, true)
    : outputAmount && quote?.spotPrice
      ? fmtUsdValue(outputAmount, false)
      : null;

  // ── Active pool pair (single-hop) ──────────────────────────────────────────
  // Use quote.poolId when available (exact key from contract); otherwise
  // derive a candidate "A:B" so we can prefetch contributors.
  const activePair = useMemo(() => {
    if (quote?.poolFound && quote.path && quote.path.length === 2) {
      return quote.poolId;
    }
    if (tokenIn && tokenOut) {
      // Hive Engine sorts so SWAP.HIVE is the base when present
      if (tokenIn.symbol === "SWAP.HIVE") return `${tokenIn.symbol}:${tokenOut.symbol}`;
      if (tokenOut.symbol === "SWAP.HIVE") return `${tokenOut.symbol}:${tokenIn.symbol}`;
      return `${tokenIn.symbol}:${tokenOut.symbol}`;
    }
    return null;
  }, [quote, tokenIn, tokenOut]);

  const { data: contributors, isLoading: contributorsLoading } = useSWR<LiquidityPosition[]>(
    activePair ? ["pool-contributors", activePair] : null,
    () => fetchPoolLiquidityPositions(activePair!),
    { revalidateOnFocus: false, refreshInterval: 60_000 },
  );

  const totalShares = useMemo(() => {
    if (!contributors) return 0;
    return contributors.reduce((acc, p) => acc + (parseFloat(p.shares) || 0), 0);
  }, [contributors]);

  const isMultiHop = !!(quote?.path && quote.path.length > 2);
  const pairLabel = activePair ? activePair.replace(":", " / ") : "Select tokens";

  // ── Fetch all pools (cached/shared with /pools page) for detailed stats ─
  const { data: allPools } = useSWR<Pool[]>(
    ["pools"],
    () => fetchPools(),
    { revalidateOnFocus: false, refreshInterval: 60_000, dedupingInterval: 30_000 },
  );

  const activePool = useMemo(() => {
    if (!allPools || !activePair) return null;
    return allPools.find((p) => p.tokenPair === activePair) ?? null;
  }, [allPools, activePair]);

  const tvlUsdNum = activePool ? parseFloat(activePool.tvlUsd) : 0;
  const volUsdNum = activePool ? parseFloat(activePool.volumeUsd) : 0;
  const baseQtyNum = activePool ? parseFloat(activePool.baseQuantity) : 0;
  const quoteQtyNum = activePool ? parseFloat(activePool.quoteQuantity) : 0;
  const baseVolNum = activePool ? parseFloat(activePool.baseVolume) : 0;
  const quoteVolNum = activePool ? parseFloat(activePool.quoteVolume) : 0;
  const totalSharesNum = activePool ? parseFloat(activePool.totalShares) : 0;
  const basePriceNum = activePool ? parseFloat(activePool.basePrice) : 0;
  const quotePriceNum = activePool ? parseFloat(activePool.quotePrice) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PageHeader
        icon={Shuffle}
        title="Swap"
        description="Instantly swap tokens through Diesel Pools at the best available rate."
      />
      {/* ── Pool header strip ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0" style={{ width: 52, height: 28 }}>
            <div className="absolute left-0 top-0">
              <TokenIcon icon={tokenIn?.icon ?? null} symbol={tokenIn?.symbol ?? "?"} size={28} />
            </div>
            <div className="absolute left-[24px] top-0 rounded-full ring-2 ring-card">
              <TokenIcon icon={tokenOut?.icon ?? null} symbol={tokenOut?.symbol ?? "?"} size={28} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {activePair ? (
                <Link
                  to="/pool/$pair"
                  params={{ pair: activePair }}
                  className="group flex items-center gap-1.5 truncate font-display text-base font-semibold text-foreground hover:text-primary"
                  title="View pool details"
                >
                  <span className="truncate">{pairLabel}</span>
                  <ExternalLink className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
                </Link>
              ) : (
                <h2 className="truncate font-display text-base font-semibold text-foreground">{pairLabel}</h2>
              )}
              {quote?.feePercent != null && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {quote.feePercent}%
                </Badge>
              )}
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {activePool?.creator
                ? <>created by <span className="text-foreground">@{activePool.creator}</span></>
                : "Hive Engine AMM Pool"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <HeaderStat
            label="Liquidity"
            value={activePool ? fmtUsd(tvlUsdNum) : "—"}
            sub={activePool ? `${fmtCompact(baseQtyNum * 2)} ${activePool.base}` : undefined}
          />
          <HeaderStat
            label="Volume"
            value={activePool ? fmtUsd(volUsdNum) : "—"}
            sub={activePool ? `${fmtCompact(baseVolNum)} ${activePool.base}` : undefined}
          />
        </div>

      </div>

      {/* ── Swap widget ────────────────────────────────────────────── */}
      <div className="w-full">


      {/* Card */}
      <div className="rounded-2xl border border-border bg-card shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Swap</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { refreshQuote(); refreshBalances(); }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Refresh quote"
            >
              <RefreshCw className="size-3.5" />
            </button>
            <SlippageSettings slippage={slippage} onSlippageChange={setSlippage} />
          </div>
        </div>

        {/* Inputs */}
        <div className="relative px-5 py-4">
          <TokenAmountInput
            label="From"
            token={tokenIn}
            tokens={tokens ?? []}
            loading={tokensLoading}
            amount={amountIn}
            onAmountChange={setAmountIn}
            onTokenSelect={(t) => {
              setTokenIn(t);
              if (tokenOut?.symbol === t.symbol) setTokenOut(tokenIn);
            }}
            balances={balances}
            excludeSymbol={tokenOut?.symbol}
            onMaxClick={handleMax}
            usdValue={usdIn}
          />

          {/* Swap sides button */}
          <div className="relative z-10 flex justify-center py-2">
            <button
              type="button"
              onClick={handleSwapSides}
              className="flex size-9 items-center justify-center rounded-xl border-2 border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-primary/50 hover:bg-accent hover:text-primary active:scale-95"
              aria-label="Swap token positions"
            >
              <ArrowDownUp className="size-4" />
            </button>
          </div>

          <TokenAmountInput
            label="To (estimated)"
            token={tokenOut}
            tokens={tokens ?? []}
            loading={tokensLoading}
            amount={quoteLoading ? "..." : outputAmount}
            readonly
            onTokenSelect={(t) => {
              setTokenOut(t);
              if (tokenIn?.symbol === t.symbol) setTokenIn(tokenOut);
            }}
            balances={balances}
            excludeSymbol={tokenIn?.symbol}
            usdValue={usdOut}
          />
        </div>

        {/* Quote info */}
        <div className="px-5 pb-4">
          {quoteLoading && amountIn && parseFloat(amountIn) > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card/30 px-4 py-3">
              <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground">Fetching best price…</span>
            </div>
          )}

          {noPool && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="size-4 flex-shrink-0 text-destructive" />
              <p className="text-[12px] text-destructive">
                No liquidity pool found for{" "}
                <strong>{tokenIn?.symbol}/{tokenOut?.symbol}</strong>.
              </p>
            </div>
          )}

          {quote && quote.poolFound && quote.priceImpact >= 3 && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
              <AlertTriangle className="size-4 flex-shrink-0 text-warning" />
              <p className="text-[12px] text-warning">
                High price impact ({quote.priceImpact.toFixed(1)}%). Reduce the amount to get a better rate.
              </p>
            </div>
          )}

          {insufficientBalance && tokenIn && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="size-4 flex-shrink-0 text-destructive" />
              <p className="text-[12px] text-destructive">
                Insufficient {tokenIn.symbol} balance.
              </p>
            </div>
          )}

          {quote && quote.poolFound && (
            <RouteInfo quote={quote} slippage={slippage} />
          )}

          {/* Swap button */}
          <Button
            className="mt-3 h-12 w-full rounded-xl text-[15px] font-semibold"
            disabled={!canSwap}
            onClick={handleSwap}
          >
            {swapping
              ? "Swapping…"
              : !username
              ? "Sign in to Swap"
              : !tokenIn || !tokenOut
              ? "Select tokens"
              : !amountIn || parseFloat(amountIn) === 0
              ? "Enter amount"
              : quoteLoading
              ? "Getting quote…"
              : noPool
              ? "No pool available"
              : insufficientBalance
              ? `Insufficient ${tokenIn?.symbol}`
              : "Swap"}
          </Button>

          {!username && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Connect your Hive Keychain wallet to swap
            </p>
          )}
        </div>
      </div>

      </div>
    </div>
  );

}

// ── HeaderStat helper ─────────────────────────────────────────────────────────

function HeaderStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate font-mono text-[13px] font-semibold text-foreground">{value}</p>
      {sub && <p className="truncate font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PoolStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-[17px] font-semibold text-foreground break-all">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
