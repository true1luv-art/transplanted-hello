import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StudioStep } from "@/features/types/generation";

const steps: { id: StudioStep; label: string }[] = [
  { id: "generate", label: "Generate" },
  { id: "preview", label: "Preview & Edit" },
  { id: "export", label: "Export" },
];

export function StudioStepper({
  step,
  canPreview,
  onStep,
}: {
  step: StudioStep;
  canPreview: boolean;
  onStep: (step: StudioStep) => void;
}) {
  const index = steps.findIndex((s) => s.id === step);

  return (
    <nav aria-label="Studio steps" className="flex items-center gap-2">
      {steps.map((item, i) => {
        const active = item.id === step;
        const done = i < index;
        const locked = item.id !== "generate" && !canPreview;
        return (
          <button
            key={item.id}
            type="button"
            disabled={locked}
            onClick={() => onStep(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
              locked && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-xs font-semibold",
                active ? "bg-primary text-primary-foreground" : "bg-surface-raised",
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
