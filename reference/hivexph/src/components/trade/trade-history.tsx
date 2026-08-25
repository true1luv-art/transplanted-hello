
interface TradeEntry {
  _id: number;
  type: "buy" | "sell";
  buyer: string;
  seller: string;
  symbol: string;
  quantity: string;
  price: string;
  timestamp: number;
  volume: string;
}

function fmtDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function TradeHistory({ trades, symbol }: { trades: TradeEntry[]; symbol: string }) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Trade History
        </span>
        <span className="text-[11px] text-muted-foreground">{symbol}/HIVE</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Column labels */}
          <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1.5fr_1.5fr_1.5fr] gap-4 border-b border-border/30 px-4 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Buyer</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Seller</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{symbol}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</span>
            <span className="text-[10px] uppercase tracking-wider text-right text-muted-foreground">Total HIVE</span>
          </div>

          {/* Rows */}
          <div>
            {trades.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">No recent trades</p>
            ) : (
              trades.map((t) => {
                const isBuy = t.type === "buy";
                const total = (parseFloat(t.price) * parseFloat(t.quantity)).toFixed(8);
                return (
                  <div
                    key={t._id}
                    className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1.5fr_1.5fr_1.5fr] gap-4 px-4 py-[5px] text-[12px] hover:bg-accent/30"
                  >
                    <span className="font-mono text-muted-foreground">{fmtDateTime(t.timestamp)}</span>
                    <span className={`font-mono uppercase ${isBuy ? "text-emerald-400" : "text-rose-400"}`}>
                      {t.type}
                    </span>
                    <span className="font-mono text-foreground">{t.buyer}</span>
                    <span className="font-mono text-foreground">{t.seller}</span>
                    <span className="font-mono text-foreground">
                      {parseFloat(t.quantity).toFixed(8)}
                    </span>
                    <span className="font-mono text-foreground">
                      {parseFloat(t.price).toFixed(8)}
                    </span>
                    <span className="font-mono text-right text-foreground">{total}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
