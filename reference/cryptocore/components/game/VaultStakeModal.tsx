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
import { vaultCapacity } from "@/features/game/mining";
import { firewallFromVault, luckFromVault } from "@/features/game/stats";
import { formatHash } from "@/lib/format";
import { notify } from "@/lib/notify";
import { usePlayerStore } from "@/features/stores/playerStore";

export function VaultStakeModal({
  wallet,
  vaultStaked,
  hashRate,
}: {
  wallet: number;
  vaultStaked: number;
  hashRate: number;
}) {
  const stakeVault = usePlayerStore((state) => state.stakeVault);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const qty = Number(amount);
  const valid = Number.isFinite(qty) && qty > 0 && qty <= wallet;
  const nextStaked = vaultStaked + (valid ? qty : 0);

  const luck = luckFromVault(vaultStaked);
  const nextLuck = luckFromVault(nextStaked);
  const firewall = firewallFromVault(vaultStaked);
  const nextFirewall = firewallFromVault(nextStaked);

  const confirm = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      if (await stakeVault(qty)) {
        notify(`Vault increased — sent ${formatHash(qty)} HASH`, "success");
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
        <StatActionButton>Increase Vault</StatActionButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Increase Vault</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Send HASH to your vault to increase its capacity and raise your Luck and Firewall skills.
          HASH in the vault stays in the rig.
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
              <span className="text-primary">▲</span> Vault capacity:{" "}
              <span className="text-foreground tabular-nums">
                {formatHash(vaultCapacity(nextStaked, hashRate), 0)} HASH
              </span>
            </div>
            <div>
              <span className="text-primary">▲</span> Luck:{" "}
              <span className="font-semibold text-primary">
                +{Math.max(0, nextLuck - luck).toFixed(3)}%
              </span>
              , Total: <span className="text-foreground">{nextLuck.toFixed(3)}%</span>
            </div>
            <div>
              <span className="text-primary">▲</span> Firewall:{" "}
              <span className="font-semibold text-primary">
                +{Math.max(0, nextFirewall - firewall).toFixed(3)}%
              </span>
              , Total: <span className="text-foreground">{nextFirewall.toFixed(3)}%</span>
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
