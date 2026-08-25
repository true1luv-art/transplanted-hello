import { useEffect, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { maxAffordableUpgrades, totalUpgradeCost } from "@/features/game/stats";
import { formatHash, formatInt } from "@/lib/format";
import { notify } from "@/lib/notify";
import { usePlayerStore } from "@/features/stores/playerStore";
import type { StatKey } from "@/features/types/game";

interface StatUpgradeModalProps {
  statKey: StatKey;
  label: string;
  currentLevel: number;
  gearBonus: number;
  wallet: number;
}

export function StatUpgradeModal({
  statKey,
  label,
  currentLevel,
  gearBonus,
  wallet,
}: StatUpgradeModalProps) {
  const upgradeStatBulk = usePlayerStore((state) => state.upgradeStatBulk);
  const [open, setOpen] = useState(false);
  const [levels, setLevels] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const maxLevels = maxAffordableUpgrades(currentLevel, wallet);
  const clampedLevels = Math.min(levels, Math.max(1, maxLevels));
  const cost = totalUpgradeCost(currentLevel, clampedLevels);
  const nextLevel = currentLevel + clampedLevels;
  const canAfford = maxLevels > 0 && wallet >= cost;

  useEffect(() => {
    if (open) setLevels(1);
  }, [open]);

  const confirm = async () => {
    if (!canAfford || submitting) return;
    setSubmitting(true);
    try {
      const bought = await upgradeStatBulk(statKey, clampedLevels);
      if (bought > 0) {
        notify(`${label} upgraded to level ${formatInt(nextLevel)}`, "success");
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <StatActionButton disabled={maxLevels === 0}>Upgrade</StatActionButton>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade {label}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Choose how many levels to buy at once. Cost scales with level squared.
        </p>

        <div className="mt-2 space-y-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current level</span>
            <span className="font-mono font-semibold text-foreground">
              {formatInt(currentLevel)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="upgrade-levels" className="text-sm text-muted-foreground">
                Levels to buy
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="upgrade-levels"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, maxLevels)}
                  step={1}
                  value={clampedLevels}
                  onChange={(event) => setLevels(Number(event.target.value))}
                  className="w-20 text-right"
                  disabled={maxLevels === 0}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={maxLevels === 0}
                  onClick={() => setLevels(maxLevels)}
                >
                  Max
                </Button>
              </div>
            </div>
            <Slider
              value={[clampedLevels]}
              min={1}
              max={Math.max(1, maxLevels)}
              step={1}
              disabled={maxLevels === 0}
              onValueChange={(value) => setLevels(value[0] ?? 1)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>{formatInt(maxLevels)}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New level</span>
              <span className="font-mono font-semibold text-foreground">
                {formatInt(nextLevel)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gear bonus</span>
              <span className="font-mono text-success">+{formatInt(gearBonus)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Total cost</span>
              <span className="font-mono font-semibold text-primary">
                {formatHash(cost, 0)} HASH
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Wallet balance</span>
            <span className="font-mono text-foreground">{formatHash(wallet)} HASH</span>
          </div>
        </div>

        <Button
          className="mt-2 w-full"
          variant="outline"
          disabled={!canAfford}
          loading={submitting}
          onClick={confirm}
        >
          {submitting
            ? "Upgrading…"
            : `Confirm ${clampedLevels > 1 ? `${formatInt(clampedLevels)} levels` : "1 level"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
