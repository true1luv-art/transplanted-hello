
import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface OrderEntry {
  _id: number;
  account: string;
  symbol: string;
  quantity: string;
  price: string;
}

interface DepthPoint {
  price: number;
  buy?: number;
  sell?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-[12px] shadow-lg">
      <p className="mb-1 font-mono font-semibold text-foreground">{label.toFixed(8)}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="uppercase text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold text-foreground">
            {p.value.toFixed(8)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DepthChart({
  buyBook,
  sellBook,
  lastPrice,
}: {
  buyBook: OrderEntry[];
  sellBook: OrderEntry[];
  lastPrice: string;
}) {
  const midPrice = parseFloat(lastPrice);

  const { chartData, lo, hi } = useMemo(() => {
    // BIDS: sort ascending by price, accumulate from outside (lowest price)
    // toward the spread so the curve peaks at the best bid (closest to mid).
    const buys = [...buyBook]
      .map((o) => ({ price: parseFloat(o.price), qty: parseFloat(o.quantity) }))
      .filter((o) => o.price > 0 && o.qty > 0)
      .sort((a, b) => a.price - b.price); // lowest bid first

    let cumBuy = 0;
    const buyPoints: DepthPoint[] = buys.map(({ price, qty }) => {
      cumBuy += qty;
      return { price, buy: cumBuy };
    });

    // ASKS: sort descending by price, accumulate from outside (highest price)
    // toward the spread so the curve peaks at the best ask (closest to mid).
    const sells = [...sellBook]
      .map((o) => ({ price: parseFloat(o.price), qty: parseFloat(o.quantity) }))
      .filter((o) => o.price > 0 && o.qty > 0)
      .sort((a, b) => b.price - a.price); // highest ask first

    let cumSell = 0;
    const sellPointsDesc: DepthPoint[] = sells.map(({ price, qty }) => {
      cumSell += qty;
      return { price, sell: cumSell };
    });
    // Re-order ascending for charting on the x-axis
    const sellPoints = [...sellPointsDesc].sort((a, b) => a.price - b.price);

    // Bridge each side to the mid so the two areas meet at the spread.
    const bestBid = buys.length ? buys[buys.length - 1].price : undefined;
    const bestAsk = sells.length ? sells[sells.length - 1].price : undefined;
    const mid =
      bestBid && bestAsk
        ? (bestBid + bestAsk) / 2
        : midPrice || bestBid || bestAsk || 0;
    const peakBuyCum = buyPoints.length ? buyPoints[buyPoints.length - 1].buy! : 0;
    const peakSellCum = sellPoints.length ? sellPoints[0].sell! : 0;
    if (buyPoints.length) buyPoints.push({ price: mid, buy: peakBuyCum });
    if (sellPoints.length) sellPoints.unshift({ price: mid, sell: peakSellCum });


    const merged: Record<string, DepthPoint> = {};
    for (const p of buyPoints) {
      const k = p.price.toFixed(10);
      merged[k] = { ...merged[k], price: p.price, buy: p.buy };
    }
    for (const p of sellPoints) {
      const k = p.price.toFixed(10);
      merged[k] = { ...merged[k], price: p.price, sell: p.sell };
    }
    const all = Object.values(merged).sort((a, b) => a.price - b.price);

    const refPrice = mid || midPrice;
    const lo = refPrice * 0.8;
    const hi = refPrice * 1.2;
    const visible = all.filter((d) => d.price >= lo && d.price <= hi);
    const chartData = visible.length >= 4 ? visible : all;
    const xs = chartData.map((d) => d.price);
    return {
      chartData,
      lo: xs.length ? Math.min(...xs) : lo,
      hi: xs.length ? Math.max(...xs) : hi,
    };
  }, [buyBook, sellBook, midPrice]);

  if (!chartData.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-[13px] text-muted-foreground">
        No depth data available
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 4, bottom: 20, left: 0 }}
        >
          <defs>
            <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="price"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => v.toFixed(6)}
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            height={20}
          />
          <YAxis
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
            axisLine={false}
            tickLine={false}
            width={48}
            x={0}
            orientation="left"
          />

          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.3, strokeDasharray: "4 4", strokeWidth: 1 }} />

          {/* Mid-price reference line */}
          {midPrice > 0 && (
            <ReferenceLine
              x={midPrice}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}

          {/* Buy area */}
          <Area
            type="stepAfter"
            dataKey="buy"
            name="BUY"
            stroke="#34d399"
            strokeWidth={1.5}
            fill="url(#buyGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#34d399", strokeWidth: 0 }}
            connectNulls={false}
          />

          {/* Sell area */}
          <Area
            type="stepBefore"
            dataKey="sell"
            name="SELL"
            stroke="#f87171"
            strokeWidth={1.5}
            fill="url(#sellGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#f87171", strokeWidth: 0 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-400" />
          <span className="text-[11px] font-medium text-muted-foreground">BUY</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-rose-400" />
          <span className="text-[11px] font-medium text-muted-foreground">SELL</span>
        </div>
      </div>
    </div>
  );
}
