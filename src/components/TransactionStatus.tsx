import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TxState = "idle" | "pending" | "success" | "error";

export function TransactionStatus({
  state,
  pendingLabel = "Broadcasting to Hive",
  successLabel = "Transaction confirmed",
  errorLabel = "Transaction failed",
  txId,
  className,
}: {
  state: TxState;
  pendingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  txId?: string;
  className?: string;
}) {
  if (state === "idle") return null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm",
        state === "success" && "border-success/30 text-success",
        state === "error" && "border-destructive/40 text-destructive",
        className,
      )}
    >
      {state === "pending" ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
      {state === "success" ? <CheckCircle2 className="size-4" /> : null}
      {state === "error" ? <XCircle className="size-4" /> : null}
      <div className="min-w-0">
        <p className="font-medium">
          {state === "pending" ? pendingLabel : state === "success" ? successLabel : errorLabel}
        </p>
        {txId ? <p className="truncate font-mono text-xs text-muted-foreground">{txId}</p> : null}
      </div>
    </div>
  );
}
