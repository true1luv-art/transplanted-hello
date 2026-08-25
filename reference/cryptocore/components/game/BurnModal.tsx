import { useState } from "react";

import { StatActionButton } from "@/components/game/StatUpgradeCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { exploitFromNotoriety } from "@/features/game/stats";
import { formatHash, formatInt } from "@/lib/format";
import { notify } from "@/lib/notify";
import { usePlayerStore } from "@/features/stores/playerStore";

export function BurnModal({ wallet, notoriety }: { wallet: number; notoriety: number }) {
  const burn = usePlayerStore((state) => state.burn);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const qty = Number(amount);
  const valid = Number.isFinite(qty) && qty > 0 && qty <= wallet;
  const nextNotoriety = notoriety + (valid ? qty : 0);

  const exploit = exploitFromNotoriety(notoriety);
  const nextExploit = exploitFromNotoriety(nextNotoriety);

  const confirm = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      if (await burn(qty)) {
        notify(`Sent ${formatHash(qty)} HASH · +${formatInt(qty)} Notoriety`, "success");
        setAmount("");
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <StatActionButton>Gain Notoriety</StatActionButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gain Notoriety</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Send HASH to Notoriety to increase your Exploit skill and unlock future content. HASH sent
          to Notoriety stays in the rig.
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <span className="text-xs font-semibold tracking-widest text-muted-foreground">
              HASH
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Wallet balance:</span>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setAmount(String(Math.floor(wallet)))}
            >
              {formatHash(wallet)} HASH
            </button>
          </div>
          <div className="space-y-1 border-t border-border/40 pt-2 text-xs text-muted-foreground">
            <div>
              <span className="text-primary">▲</span> Notoriety: +{valid ? formatHash(qty) : "0.00"}
              , Total:{" "}
              <span className="text-foreground tabular-nums">{formatHash(nextNotoriety)}</span>
            </div>
            <div>
              <span className="text-primary">▲</span> Exploit:{" "}
              <span className="font-semibold text-primary">
                +{Math.max(0, nextExploit - exploit).toFixed(3)}%
              </span>
              , Total: <span className="text-foreground">{nextExploit.toFixed(3)}%</span>
            </div>
          </div>
        </div>
        <Button
          className="mt-4 w-full"
          variant="outline"
          disabled={!valid}
          loading={submitting}
          onClick={confirm}
        >
          {submitting ? "Sending…" : "Confirm"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
