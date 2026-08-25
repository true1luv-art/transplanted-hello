
import { useApi, fetchTransactions, type TransactionsResult, type Layer } from "@/hooks/useAxios";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HiveEngineTx, HiveTransferTx } from '@/lib/fetchers/hive-history';

const PAGE_SIZE = 50;

const LAYER_LABELS: Record<Layer, string> = {
  l2: "Hive Engine (Layer 2)",
  l1: "HIVE Transfers (Layer 1)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateFromIso(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtDateFromUnix(ts: number) {
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function operationLabel(op: string) {
  return op
    .replace(/^tokens_/, "")
    .replace(/^market_/, "Market ")
    .replace(/^marketpools_/, "Pool ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DirectionBadge({ incoming }: { incoming: boolean }) {
  return (
    <span className={`inline-flex size-7 items-center justify-center rounded-full ${
      incoming ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
    }`}>
      {incoming ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border/30">
          <td className="px-4 py-3"><div className="size-7 animate-pulse rounded-full bg-muted/30" /></td>
          <td className="px-4 py-3"><div className="h-3 w-28 animate-pulse rounded bg-muted/30" /><div className="mt-1 h-2.5 w-20 animate-pulse rounded bg-muted/20" /></td>
          <td className="px-4 py-3"><div className="h-3 w-20 animate-pulse rounded bg-muted/30" /></td>
          <td className="px-4 py-3"><div className="h-3 w-24 animate-pulse rounded bg-muted/30" /></td>
          <td className="px-4 py-3"><div className="h-3 w-32 animate-pulse rounded bg-muted/30" /></td>
        </tr>
      ))}
    </>
  );
}

// ── L2 row ────────────────────────────────────────────────────────────────────

function L2Row({ tx, username }: { tx: HiveEngineTx; username: string }) {
  const isTransfer = tx.operation === "tokens_transfer";
  const incoming   = tx.to === username;

  // Resolve the best available quantity depending on operation type
  const rawQty =
    tx.quantity       ??  // tokens_transfer, tokens_issue
    tx.quantityTokens ??  // market_sell, market_buy
    tx.quantityLocked ??  // market_placeOrder
    null;
  const qty    = rawQty != null ? parseFloat(rawQty) : NaN;
  const hasQty = !isNaN(qty);

  // Resolve counterparty — skip internal contract accounts
  const rawCounterparty = incoming ? tx.from : tx.to;
  const counterparty =
    rawCounterparty && rawCounterparty !== "" && !rawCounterparty.startsWith("contract_")
      ? `@${rawCounterparty}`
      : null;

  return (
    <tr className="border-b border-border/30 text-[13px]">
      <td className="px-4 py-3">
        {isTransfer
          ? <DirectionBadge incoming={incoming} />
          : (
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
              <ArrowLeftRight className="size-3.5" />
            </span>
          )
        }
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-foreground">{operationLabel(tx.operation)}</span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDateFromUnix(tx.timestamp)}</p>
      </td>
      <td className="px-4 py-3 text-[13px] text-muted-foreground">
        {counterparty ?? <span className="italic opacity-40">—</span>}
      </td>
      <td className="px-4 py-3">
        {hasQty ? (
          <>
            <span className={`font-mono font-medium ${
              isTransfer ? (incoming ? "text-emerald-400" : "text-rose-400") : "text-foreground"
            }`}>
              {isTransfer ? (incoming ? "+" : "-") : ""}
              {qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </span>
            {" "}
            {tx.symbol && <Badge variant="secondary" className="font-mono text-[10px]">{tx.symbol}</Badge>}
          </>
        ) : (
          tx.symbol
            ? <Badge variant="secondary" className="font-mono text-[10px]">{tx.symbol}</Badge>
            : <span className="italic text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-4 py-3 max-w-[200px] text-[12px] text-muted-foreground">
        {tx.memo
          ? <span className="block truncate">{tx.memo}</span>
          : <span className="italic opacity-40">—</span>}
      </td>
    </tr>
  );
}

// ── L1 row ────────────────────────────────────────────────────────────────────

function L1Row({ tx, username }: { tx: HiveTransferTx; username: string }) {
  const incoming = tx.to === username;
  const [amountStr, symbol] = tx.amount.split(" ");
  return (
    <tr className="border-b border-border/30 text-[13px]">
      <td className="px-4 py-3"><DirectionBadge incoming={incoming} /></td>
      <td className="px-4 py-3">
        <span className="font-medium text-foreground">Transfer</span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDateFromIso(tx.timestamp)}</p>
      </td>
      <td className="px-4 py-3 text-[13px] text-muted-foreground">
        {incoming ? `@${tx.from}` : `@${tx.to}`}
      </td>
      <td className="px-4 py-3">
        <span className={`font-mono font-medium ${incoming ? "text-emerald-400" : "text-rose-400"}`}>
          {incoming ? "+" : "-"}{Number(amountStr).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 6 })}
        </span>
        {" "}
        <Badge variant="secondary" className="font-mono text-[10px]">{symbol}</Badge>
      </td>
      <td className="px-4 py-3 max-w-[200px] text-[12px] text-muted-foreground">
        {tx.memo
          ? <span className="block truncate">{tx.memo}</span>
          : <span className="italic opacity-40">—</span>}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransactionsClient({ username }: { username: string }) {
  const [layer,   setLayer]   = useState<Layer>("l2");
  const [offset,  setOffset]  = useState(0);
  // For L1 cursor pagination: stack of startSeq values per page
  const [l1Stack, setL1Stack] = useState<number[]>([-1]);
  const l1StartSeq = l1Stack[l1Stack.length - 1] ?? -1;

  const txKey = layer === "l2"
    ? `txns-l2-${username}-${offset}`
    : `txns-l1-${username}-${l1StartSeq}`;

  const { data, isLoading, mutate } = useApi<TransactionsResult>(
    [txKey, () => fetchTransactions(layer, PAGE_SIZE, offset, l1StartSeq, username)],
    { keepPreviousData: true },
  );

  const txns    = data?.txns ?? [];
  const hasNext = txns.length === PAGE_SIZE;
  const hasPrev = layer === "l2" ? offset > 0 : l1Stack.length > 1;
  const page    = layer === "l2"
    ? Math.floor(offset / PAGE_SIZE) + 1
    : l1Stack.length;

  function handleLayerChange(next: Layer) {
    setLayer(next);
    setOffset(0);
    setL1Stack([-1]);
  }

  function handleNext() {
    if (layer === "l2") {
      setOffset((o) => o + PAGE_SIZE);
    } else {
      // The last item in the current page gives the cursor for the next page.
      // L1 rows come back newest-first; last item is the oldest on this page.
      const l1Txns = txns as HiveTransferTx[];
      const lastId = l1Txns[l1Txns.length - 1]?.id;
      if (lastId != null) setL1Stack((s) => [...s, lastId - 1]);
    }
  }

  function handlePrev() {
    if (layer === "l2") {
      setOffset((o) => Math.max(0, o - PAGE_SIZE));
    } else {
      setL1Stack((s) => s.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-[15px] font-semibold text-foreground">Account history</h2>

        <div className="flex items-center gap-2">
          {/* Layer filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]">
                {layer === "l2" ? "Layer 2" : "Layer 1"}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {(Object.keys(LAYER_LABELS) as Layer[]).map((l) => (
                <DropdownMenuItem
                  key={l}
                  onClick={() => handleLayerChange(l)}
                  className={layer === l ? "bg-accent text-accent-foreground" : ""}
                >
                  {LAYER_LABELS[l]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-[12px] text-muted-foreground"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card/20 overflow-hidden">
        {!isLoading && txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowLeftRight className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-[14px] font-medium text-muted-foreground">No transactions yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground/60">
              {layer === "l2"
                ? "Your Hive Engine token history will appear here."
                : "Your HIVE transfer history will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/60 bg-card/40">
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
                    {layer === "l2" ? "Operation" : "Type"}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Counterparty</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Memo</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows />
                ) : layer === "l2" ? (
                  (txns as HiveEngineTx[]).map((tx) => (
                    <L2Row key={tx._id} tx={tx} username={username} />
                  ))
                ) : (
                  (txns as HiveTransferTx[]).map((tx) => (
                    <L1Row key={`${tx.id}-${tx.trx_id}`} tx={tx} username={username} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
            <span className="text-[12px] text-muted-foreground">Page {page}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[12px]"
                disabled={!hasPrev || isLoading}
                onClick={handlePrev}
              >
                <ChevronLeft className="size-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-[12px]"
                disabled={!hasNext || isLoading}
                onClick={handleNext}
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
