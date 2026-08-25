import { useEffect, useState } from "react";
import { shortDate, timeAgo } from "@/lib/format";

/** Relative timestamps are client-only to avoid SSR hydration drift. */
export function ClientTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState<string>("");
  useEffect(() => {
    setLabel(timeAgo(iso));
    const t = setInterval(() => setLabel(timeAgo(iso)), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return <span className={className}>{label || "\u00a0"}</span>;
}

/** Absolute dates are client-only too: mock data timestamps can differ across SSR. */
export function ClientDate({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState<string>("");
  useEffect(() => {
    setLabel(shortDate(iso));
  }, [iso]);
  return <span className={className}>{label || "\u00a0"}</span>;
}
