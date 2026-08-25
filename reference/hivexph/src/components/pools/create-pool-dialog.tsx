import { useMemo, useState } from "react";
import useSWR from "swr";
import axios from "axios";
import { AlertTriangle, Info, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchAllTokens, type BasicToken } from "@/lib/fetchers/tokens";
import { fetchPools, type Pool } from "@/lib/fetchers/pools";
import { HIVE_ENGINE_CONFIG } from "@/lib/config/api";
import { execute as createPool } from "@/lib/events/create-pool/action";
import { TokenPicker, type TokenPickerItem } from "@/components/shared/token-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const HE_RPC = HIVE_ENGINE_CONFIG.rpcUrl;
const POOL_FEE_SYMBOL = "BEE";
const POOL_FEE = 1000;

async function fetchBeeBalance(username: string): Promise<number> {
  if (!username) return 0;
  const res = await axios.post<{ result: Array<{ balance: string }> }>(HE_RPC, {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "find",
    params: {
      contract: "tokens",
      table: "balances",
      query: { account: username, symbol: POOL_FEE_SYMBOL },
      limit: 1,
      offset: 0,
      indexes: [],
    },
  });
  const row = res.data?.result?.[0];
  return row ? parseFloat(row.balance) || 0 : 0;
}

export function CreatePoolDialog({
  username,
  trigger,
}: {
  username: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState("");
  const [quote, setQuote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: tokens } = useSWR<BasicToken[]>(
    open ? "all-tokens" : null,
    fetchAllTokens,
    { revalidateOnFocus: false },
  );

  const { data: pools } = useSWR<Pool[]>(
    open ? "pools" : null,
    fetchPools,
    { revalidateOnFocus: false },
  );

  const {
    data: balance,
    isLoading: balanceLoading,
    mutate: refreshBalance,
  } = useSWR<number>(
    open && username ? ["beeBalance", username] : null,
    () => fetchBeeBalance(username),
    { revalidateOnFocus: false },
  );

  const tokenOptions = useMemo<TokenPickerItem[]>(() => {
    const list = (tokens ?? []).map((t) => ({
      symbol: t.symbol,
      name: t.name,
      icon: t.icon,
    }));
    list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return list;
  }, [tokens]);

  const sameToken = !!base && !!quote && base === quote;
  const tokenPair = base && quote && !sameToken ? `${base}:${quote}` : "";

  // Detect if a pool already exists for this pair (either order)
  const existingPair = useMemo(() => {
    if (!base || !quote || sameToken || !pools) return null;
    const a = `${base}:${quote}`;
    const b = `${quote}:${base}`;
    return pools.find((p) => p.tokenPair === a || p.tokenPair === b) ?? null;
  }, [pools, base, quote, sameToken]);

  const insufficient = (balance ?? 0) < POOL_FEE;
  const canSubmit =
    !!username && !!tokenPair && !insufficient && !existingPair && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createPool({ username, tokenPair });
      toast.success(`Pool ${tokenPair} creation broadcast`);
      setOpen(false);
      setBase("");
      setQuote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create pool");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 rounded-2xl border-border/60 bg-card p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-xl font-bold">Create Pool</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 p-6">
          {/* Info box */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Info className="size-4" /> Info
            </div>
            <p className="mt-2 text-sm text-foreground/90">
              Pool creation costs{" "}
              <span className="font-mono font-bold">{POOL_FEE} BEE</span>.{" "}
              {username ? (
                <>
                  Your current balance is{" "}
                  <span
                    className={cn(
                      "font-mono font-bold",
                      insufficient ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {balanceLoading
                      ? "…"
                      : (balance ?? 0).toLocaleString(undefined, {
                          maximumFractionDigits: 8,
                        })}{" "}
                    BEE
                  </span>
                  .
                </>
              ) : (
                <>Connect your account to check your balance.</>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => refreshBalance()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
              >
                <RefreshCw className="size-3" /> Refresh
              </button>
              <a
                href="https://hive-engine.com/trade/BEE"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
              >
                Buy BEE
              </a>
            </div>
          </div>

          {/* Base token */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-foreground">
              Base Token
            </label>
            <TokenPicker
              tokens={tokenOptions}
              value={base}
              onSelect={setBase}
              disabledSymbols={quote ? [quote] : []}
            />
          </div>

          {/* Quote token */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-foreground">
              Quote Token
            </label>
            <TokenPicker
              tokens={tokenOptions}
              value={quote}
              onSelect={setQuote}
              disabledSymbols={base ? [base] : []}
            />
            {sameToken && (
              <p className="mt-1 text-xs text-destructive">
                Base and quote must be different.
              </p>
            )}
          </div>

          {/* Token Pair */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-foreground">
              Token Pair
            </label>
            <div
              className={cn(
                "flex h-10 items-center rounded-lg border bg-background px-3 font-mono text-sm text-foreground",
                existingPair ? "border-destructive" : "border-border/60",
              )}
            >
              {tokenPair || <span className="text-muted-foreground">—</span>}
            </div>
            {existingPair && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 flex-shrink-0" />
                <span>
                  Pool{" "}
                  <span className="font-mono font-bold">
                    {existingPair.tokenPair}
                  </span>{" "}
                  already exists.
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Create Pool
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
