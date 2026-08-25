import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  useApi,
  fetchWalletHistory,
  type WalletHistoryData,
} from "@/hooks/useAxios";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/_app/wallet/$username/$token")({
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.token} history — @${params.username} — HiveX PH`,
      },
      {
        name: "description",
        content: `${params.token} transaction history for @${params.username}.`,
      },
    ],
  }),
  component: TokenHistoryPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

function formatAmount(quantity: string): string {
  const num = parseFloat(quantity);
  if (isNaN(num) || num === 0) return "0";
  if (Math.abs(num) >= 1_000_000_000)
    return (num / 1_000_000_000).toFixed(2) + "B";
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (Math.abs(num) >= 1_000)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return num.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

function getAmountColor(quantity: string): string {
  const num = parseFloat(quantity);
  if (num > 0) return "text-emerald-400";
  if (num < 0) return "text-red-400";
  return "text-muted-foreground";
}

function TokenHistoryPage() {
  const { username, token } = Route.useParams();
  const [limit] = useState(30);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error } = useApi<WalletHistoryData>([
    `wallet-history-${username}-${token}-${limit}-${offset}`,
    () => fetchWalletHistory(username, token, limit, offset),
  ]);

  const hasNextPage = data ? data.rows.length >= limit : false;

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/wallet/$username"
          params={{ username }}
          className="inline-flex size-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          title="Back to wallet"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <PageHeader
          eyebrow="HISTORY"
          title={`${token} Transaction History`}
          description={`All transactions for @${username} involving ${token}`}
        />
      </div>

      {error ? (
        <p className="py-12 text-center text-[13px] text-destructive">
          Failed to load transaction history. Please try again.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card/20">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 bg-card/40">
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Operation
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      From
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      To
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Memo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <tr key={i} className="border-b border-border/30">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-3 w-24 animate-pulse rounded bg-muted/30" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : data?.rows && data.rows.length > 0
                      ? data.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-border/30 transition-colors hover:bg-accent/20"
                          >
                            <td className="px-4 py-3">
                              <div className="text-[12px] text-foreground">
                                {row.operation}
                              </div>
                              <div className="mt-1 font-mono text-[12px] text-muted-foreground">
                                {formatDate(row.timestamp)}
                              </div>
                            </td>
                            <td className="truncate px-4 py-3 font-mono text-[12px] text-muted-foreground">
                              {row.from}
                            </td>
                            <td className="truncate px-4 py-3 font-mono text-[12px] text-muted-foreground">
                              {row.to}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-mono font-medium",
                                getAmountColor(row.quantity),
                              )}
                            >
                              {parseFloat(row.quantity) > 0 ? "+" : ""}
                              {formatAmount(row.quantity)} {row.symbol}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-[12px] text-muted-foreground">
                              {row.memo ? (
                                <span title={row.memo}>{row.memo}</span>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      : (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-12 text-center text-[13px] text-muted-foreground"
                            >
                              No transactions found for this period.
                            </td>
                          </tr>
                        )}
                </tbody>
              </table>
            </div>
          </div>

          {!isLoading && data && (
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>
                Showing {data.rows.length > 0 ? offset + 1 : 0} to{" "}
                {Math.min(offset + data.rows.length, offset + limit)} of at
                least {offset + data.rows.length} transactions
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="rounded border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasNextPage}
                  className="rounded border border-border px-3 py-1.5 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
