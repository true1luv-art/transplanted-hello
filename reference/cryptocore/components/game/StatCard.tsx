import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon | undefined;
  hint?: string | undefined;
  accent?: "primary" | "accent" | "success" | "danger" | "muted" | undefined;
  className?: string | undefined;
}

const accentMap = {
  primary: "text-primary bg-primary/10",
  accent: "text-accent bg-accent/10",
  success: "text-success bg-success/10",
  danger: "text-danger bg-danger/10",
  muted: "text-muted-foreground bg-muted",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
  className,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={cn("card-soft p-4 sm:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn("grid size-10 shrink-0 place-items-center rounded-xl", accentMap[accent])}
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
