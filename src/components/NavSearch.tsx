import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";

import { IpfsImage } from "@/components/IpfsImage";
import { hive } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/features/stores/app-store";

interface NavSearchProps {
  className?: string;
  onNavigate?: () => void;
}

export function NavSearch({ className, onNavigate }: NavSearchProps) {
  const collections = useAppStore((s) => s.collections);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...collections].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8);
    }
    return collections
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.symbol.toLowerCase().includes(q) ||
          c.creator.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const an = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bn = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return an - bn || b.volume - a.volume;
      })
      .slice(0, 8);
  }, [collections, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(id: string) {
    setOpen(false);
    setQuery("");
    onNavigate?.();
    navigate({ to: "/collections/$id", params: { id } });
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (results[active]) go(results[active].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        type="search"
        placeholder="Search collections…"
        aria-label="Search collections"
        className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-background/95 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <span className="flex-1">{query.trim() ? "Collections" : "Trending collections"}</span>
            <span className="w-24 text-right">Floor</span>
            <span className="hidden w-28 text-right sm:block">Total volume</span>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {results.length ? (
              results.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    i === active ? "bg-surface-raised" : "hover:bg-surface",
                  )}
                >
                  <IpfsImage
                    src={c.image}
                    alt={`${c.name} artwork`}
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.symbol} · @{c.creator}
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-sm">{hive(c.floorPrice)}</span>
                  <span className="hidden w-28 shrink-0 text-right text-sm text-muted-foreground sm:block">
                    {hive(c.volume, 0)}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                No collections match “{query}”.
              </p>
            )}
          </div>
          {query.trim() && results.length ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
                navigate({ to: "/collections", search: { q: query.trim() } });
              }}
              className="w-full border-t border-border px-3 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              See all results for “{query.trim()}”
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
