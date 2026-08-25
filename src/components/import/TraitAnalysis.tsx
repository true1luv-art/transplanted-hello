import { num } from "@/lib/format";
import type { ImportReport } from "@/features/lib/import/types";

/**
 * Observed trait distribution of the imported collection. These are measured
 * frequencies — the creator never configures weights on this platform.
 */
export function TraitAnalysis({ report }: { report: ImportReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="NFTs" value={num(report.statistics.totalNfts)} />
        <Stat label="Trait types" value={num(report.statistics.traitTypes)} />
        <Stat label="Trait values" value={num(report.statistics.uniqueTraitValues)} />
        <Stat label="Unique combos" value={num(report.statistics.uniqueCombinations)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {report.traits.map((trait) => (
          <div key={trait.traitType} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h4 className="font-medium">{trait.traitType}</h4>
              <span className="text-xs text-muted-foreground">
                {num(trait.uniqueValues)} values
              </span>
            </div>
            <ul className="mt-2 max-h-52 space-y-1 overflow-auto text-xs">
              {trait.values.map((value) => (
                <li key={value.value} className="flex items-center justify-between gap-3">
                  <span className="truncate text-muted-foreground">{value.value}</span>
                  <span className="shrink-0">
                    {(value.frequency * 100).toFixed(1)}%{" "}
                    <span className="text-muted-foreground">({num(value.count)})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
