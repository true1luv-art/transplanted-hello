"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuthStore } from "@/features/stores/authStore";
import { usePlayerStore } from "@/features/stores/playerStore";
import { loadAuthToken } from "@/lib/api/client";
import { formatHash } from "@/lib/format";

interface ReferredPlayer {
  username: string;
  wallet: string;
  joinedAt: number;
}

interface ReferralData {
  referralCode: string;
  referralCount: number;
  referralEarned: number;
  referred: ReferredPlayer[];
}

interface ReferralModalProps {
  open: boolean;
  onClose: () => void;
}

function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ReferralModal({ open, onClose }: ReferralModalProps) {
  const address = useAuthStore((state) => state.address);
  const username = useAuthStore((state) => state.username);
  const referralCount = usePlayerStore((state) => state.referralCount);
  const referralEarned = usePlayerStore((state) => state.referralEarned);

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !address) return;
    setLoading(true);
    fetch("/api/player/referrals", {
      headers: { Authorization: `Bearer ${loadAuthToken() ?? ""}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json as ReferralData);
      })
      .catch(() => toast.error("Failed to load referrals"))
      .finally(() => setLoading(false));
  }, [open, address]);

  // Build the link directly from username — available immediately, works in
  // demo mode too, and matches the share-stats card referral URL format.
  const referralLink = username ? `https://cryptocoresol.online/?join=${username}` : "";

  function handleCopy() {
    if (!referralLink) return;
    void navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Referrals
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Players referred
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">
                {data ? data.referralCount : referralCount}
              </p>
            </div>
            <div className="flex-1 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total earned
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-primary">
                {formatHash(data ? data.referralEarned : referralEarned, 2)} HASH
              </p>
            </div>
          </div>

          {/* Referral link */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Your referral link</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <span className="flex-1 truncate font-mono text-xs text-foreground">
                {referralLink || "Loading…"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={handleCopy}
                disabled={!referralLink}
                aria-label="Copy referral link"
              >
                {copied ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You earn 5% of HASH spent on chests by every player you refer.
            </p>
          </div>

          {/* Referred players table */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Referred players</p>
            <div className="rounded-lg border border-border overflow-hidden">
              {loading ? (
                <div className="space-y-px">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 bg-muted/20 animate-pulse"
                    >
                      <div className="size-7 rounded-full bg-muted" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2.5 w-24 rounded bg-muted" />
                        <div className="h-2 w-16 rounded bg-muted" />
                      </div>
                      <div className="h-2 w-12 rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : !data || data.referred.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No referrals yet. Share your link to earn 5% of their chest purchases.
                </div>
              ) : (
                <div className="divide-y divide-border max-h-48 overflow-y-auto">
                  {data.referred.map((player) => (
                    <div key={player.wallet} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="size-7 shrink-0 rounded-full bg-gradient-to-tr from-primary/60 via-accent/60 to-success/60 grid place-items-center font-mono text-[10px] font-bold uppercase text-primary-foreground">
                        {player.username.slice(0, 2)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {player.username}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {player.wallet.slice(0, 8)}…{player.wallet.slice(-4)}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {formatRelativeDate(player.joinedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
