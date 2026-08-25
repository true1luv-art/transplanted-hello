import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            o === value
              ? "border-primary/40 bg-primary/12 text-primary"
              : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function MarketplaceFilters<F extends string, S extends string>({
  filters,
  filter,
  onFilterChange,
  sorts,
  sort,
  onSortChange,
  query,
  onQueryChange,
  searchPlaceholder = "Search",
}: {
  filters: readonly F[];
  filter: F;
  onFilterChange: (v: F) => void;
  sorts?: readonly S[];
  sort?: S;
  onSortChange?: (v: S) => void;
  query?: string;
  onQueryChange?: (v: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <FilterPills options={filters} value={filter} onChange={onFilterChange} />
      <div className="flex flex-wrap items-center gap-2">
        {onQueryChange ? (
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query ?? ""}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 sm:w-64"
            />
          </div>
        ) : null}
        {sorts && sort && onSortChange ? (
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as S)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus-visible:border-primary/50"
            aria-label="Sort"
          >
            {sorts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
