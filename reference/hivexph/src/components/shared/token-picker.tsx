import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TokenPickerItem {
  symbol: string;
  name: string;
  icon?: string | null;
  lastPrice?: string;
  priceChangePercent?: string;
}

function pct(s: string | undefined) {
  if (!s) return 0;
  return parseFloat(s.replace("%", ""));
}

function fmtPrice(s: string | undefined, decimals = 6) {
  if (!s) return "—";
  const n = parseFloat(s);
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function TokenPicker({
  tokens,
  value,
  onSelect,
  placeholder = "Select a token",
  disabledSymbols = [],
  className,
}: {
  tokens: TokenPickerItem[];
  value: string;
  onSelect: (symbol: string) => void;
  placeholder?: string;
  disabledSymbols?: string[];
  className?: string;
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

  const active = useMemo(
    () => tokens.find((t) => t.symbol === value) ?? null,
    [tokens, value],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q),
    );
  }, [tokens, search]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none"
      >
        {active?.icon ? (
          <img
            src={active.icon}
            alt={active.symbol}
            width={20}
            height={20}
            className="size-5 flex-shrink-0 rounded-full object-contain"
            crossOrigin="anonymous"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <span className="flex-1 truncate text-left">
          {active ? (
            <>
              <span className="font-mono">{active.symbol}</span>
              <span className="ml-1 text-muted-foreground">— {active.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 flex-shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No tokens found
              </p>
            ) : (
              filtered.map((t) => {
                const change = pct(t.priceChangePercent);
                const pos = change >= 0;
                const isDisabled = disabledSymbols.includes(t.symbol);
                return (
                  <button
                    key={t.symbol}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onSelect(t.symbol);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-40",
                      t.symbol === value && "bg-primary/10",
                    )}
                  >
                    {t.icon ? (
                      <img
                        src={t.icon}
                        alt={t.symbol}
                        width={22}
                        height={22}
                        className="size-[22px] flex-shrink-0 rounded-full object-contain"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <span className="flex size-[22px] flex-shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                        {t.symbol.slice(0, 2)}
                      </span>
                    )}
                    <span className="w-[80px] flex-shrink-0 font-mono font-semibold text-foreground">
                      {t.symbol}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {t.name}
                    </span>
                    {t.lastPrice !== undefined && (
                      <div className="flex-shrink-0 text-right">
                        <div className="font-mono text-xs text-foreground">
                          {fmtPrice(t.lastPrice, 6)}
                        </div>
                        {t.priceChangePercent && (
                          <div
                            className={cn(
                              "font-mono text-[10px]",
                              pos ? "text-emerald-400" : "text-rose-400",
                            )}
                          >
                            {pos ? "+" : ""}
                            {t.priceChangePercent}
                          </div>
                        )}
                      </div>
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
