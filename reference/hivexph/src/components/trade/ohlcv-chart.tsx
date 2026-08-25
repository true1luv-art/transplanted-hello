
import { useMemo, useState } from "react";

export interface OhlcvEntry {
  timestamp:    number;
  openPrice:    string;
  closePrice:   string;
  highestPrice: string;
  lowestPrice:  string;
  volumeHive:   string;
  volumeToken:  string;
}

interface Props {
  data: OhlcvEntry[];
  view: "candle" | "volume";
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmt8(n: number) {
  return n.toFixed(8);
}

// ─── Pure-SVG candlestick chart ───────────────────────────────────────────────
const MARGIN = { top: 8, right: 8, bottom: 28, left: 72 };

export function OhlcvChart({ data, view }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    d: { date: number; open: number; high: number; low: number; close: number; vol: number };
  } | null>(null);

  const candles = useMemo(() =>
    data.map((e) => ({
      date:  e.timestamp,
      open:  parseFloat(e.openPrice),
      close: parseFloat(e.closePrice),
      high:  parseFloat(e.highestPrice),
      low:   parseFloat(e.lowestPrice),
      vol:   parseFloat(e.volumeHive),
    })),
    [data],
  );

  if (!candles.length) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        No chart data available
      </div>
    );
  }

  // We render inside a fixed-height container using a viewBox so the SVG scales.
  const W = 760;
  const H = 320;
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top  - MARGIN.bottom;

  // Price domain
  const prices = candles.flatMap((c) => [c.high, c.low]);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const padP = (maxP - minP) * 0.04 || maxP * 0.01;
  const lo   = minP - padP;
  const hi   = maxP + padP;

  // Volume domain
  const maxVol = Math.max(...candles.map((c) => c.vol));

  const priceToY = (p: number) => MARGIN.top + innerH - ((p - lo) / (hi - lo)) * innerH;
  const volToH   = (v: number) => (v / maxVol) * innerH * 0.25; // bottom 25% for volume

  const candleW = Math.max(Math.floor((innerW / candles.length) * 0.7), 1);

  // Y-axis ticks
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks }, (_, i) =>
    lo + ((hi - lo) * i) / (yTicks - 1),
  );

  // X-axis ticks — pick ~6 evenly spaced
  const xTickCount = Math.min(6, candles.length);
  const xTickIndices = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i * (candles.length - 1)) / (xTickCount - 1)),
  );

  const xPos = (i: number) =>
    MARGIN.left + (i / (candles.length - 1 || 1)) * innerW;

  return (
    <div
      className="relative h-full w-full"
      onMouseLeave={() => setTooltip(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H }}
      >
        {/* Y-axis grid lines + labels */}
        {yTickVals.map((v, i) => {
          const y = priceToY(v);
          return (
            <g key={i}>
              <line
                x1={MARGIN.left} y1={y} x2={W - MARGIN.right} y2={y}
                stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5}
              />
              <text
                x={MARGIN.left - 4} y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.5}
              >
                {v.toFixed(6)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {xTickIndices.map((idx) => (
          <text
            key={idx}
            x={xPos(idx)}
            y={H - 6}
            textAnchor="middle"
            fontSize={9}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {fmtDate(candles[idx].date)}
          </text>
        ))}

        {view === "candle" && candles.map((c, i) => {
          const x  = xPos(i);
          const positive = c.close >= c.open;
          const color    = positive ? "#34d399" : "#f87171";
          const yHigh  = priceToY(c.high);
          const yLow   = priceToY(c.low);
          const yOpen  = priceToY(c.open);
          const yClose = priceToY(c.close);
          const bodyTop = Math.min(yOpen, yClose);
          const bodyH   = Math.max(Math.abs(yOpen - yClose), 1);

          return (
            <g
              key={i}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.closest("svg") as SVGSVGElement)
                  .getBoundingClientRect();
                setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, d: c });
              }}
            >
              {/* Wick */}
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={0.8} />
              {/* Body */}
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={color}
                opacity={0.85}
              />
            </g>
          );
        })}

        {view === "volume" && candles.map((c, i) => {
          const x     = xPos(i);
          const barH  = volToH(c.vol);
          const color = c.close >= c.open ? "#34d399" : "#f87171";
          return (
            <rect
              key={i}
              x={x - candleW / 2}
              y={H - MARGIN.bottom - barH}
              width={candleW}
              height={barH}
              fill={color}
              opacity={0.7}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.closest("svg") as SVGSVGElement)
                  .getBoundingClientRect();
                setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, d: c });
              }}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-background p-2.5 text-[11px] shadow-md"
          style={{ left: tooltip.x + 12, top: Math.max(0, tooltip.y - 60) }}
        >
          <p className="mb-1 font-semibold text-foreground">{fmtDate(tooltip.d.date)}</p>
          {view === "candle" ? (
            <>
              <p className="text-muted-foreground">O: <span className="font-mono text-foreground">{fmt8(tooltip.d.open)}</span></p>
              <p className="text-muted-foreground">H: <span className="font-mono text-foreground">{fmt8(tooltip.d.high)}</span></p>
              <p className="text-muted-foreground">L: <span className="font-mono text-foreground">{fmt8(tooltip.d.low)}</span></p>
              <p className="text-muted-foreground">C: <span className="font-mono text-foreground">{fmt8(tooltip.d.close)}</span></p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Vol: <span className="font-mono text-foreground">{tooltip.d.vol.toFixed(3)} HIVE</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
