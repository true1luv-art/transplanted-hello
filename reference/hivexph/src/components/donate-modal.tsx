import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenPicker, type TokenPickerItem } from "@/components/shared/token-picker";
import { cn } from "@/lib/utils";
import { LoginModal } from "@/components/login-modal";
import { fetchTokens } from "@/lib/fetchers/tokens";
import { execute as transferTokens } from "@/lib/events/transfer-tokens/action";
import { execute as transferHeTokens } from "@/lib/events/transfer-he-tokens/action";
import type { AppUser } from "@/lib/session-shared";

type Tab = "hive" | "he";
type HiveCurrency = "HIVE" | "HBD";

const DONATION_MEMO = "donation to hivexph";

export function DonateModal({
  recipient,
  user,
  children,
}: {
  recipient: string;
  user: AppUser;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("hive");
  const [hiveCurrency, setHiveCurrency] = useState<HiveCurrency>("HIVE");
  const [hiveAmount, setHiveAmount] = useState("");
  const [heSymbol, setHeSymbol] = useState("SWAP.HIVE");
  const [heAmount, setHeAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: tokens } = useQuery({
    queryKey: ["donate-he-tokens"],
    queryFn: fetchTokens,
    enabled: open && tab === "he",
    staleTime: 5 * 60_000,
  });

  const heOptions = useMemo(() => {
    if (!tokens) return [];
    return [...tokens]
      .sort((a, b) => parseFloat(b.volumeUsd || "0") - parseFloat(a.volumeUsd || "0"))
      .slice(0, 100)
      .map((t) => ({ symbol: t.symbol, precision: t.precision }));
  }, [tokens]);

  const hePickerItems = useMemo<TokenPickerItem[]>(() => {
    if (!tokens) return [];
    return [...tokens]
      .sort((a, b) => parseFloat(b.volumeUsd || "0") - parseFloat(a.volumeUsd || "0"))
      .slice(0, 100)
      .map((t) => ({
        symbol: t.symbol,
        name: t.name,
        icon: t.icon,
        lastPrice: t.lastPrice,
        priceChangePercent: t.priceChangePercent,
      }));
  }, [tokens]);

  const selectedHe = heOptions.find((t) => t.symbol === heSymbol);

  useEffect(() => {
    if (!open) {
      setHiveAmount("");
      setHeAmount("");
      setSubmitting(false);
    }
  }, [open]);

  const handleDonate = async () => {
    if (!user.isLoggedIn) return;
    setSubmitting(true);
    try {
      if (tab === "hive") {
        const amt = parseFloat(hiveAmount);
        if (!isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
        await transferTokens({
          username: user.username,
          to: recipient,
          amount: amt,
          memo: DONATION_MEMO,
          currency: hiveCurrency,
        });
        toast.success(`Thank you! Donation of ${amt} ${hiveCurrency} broadcast.`);
      } else {
        const amt = parseFloat(heAmount);
        if (!isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount");
        if (!selectedHe) throw new Error("Select a token");
        await transferHeTokens({
          username: user.username,
          to: recipient,
          symbol: selectedHe.symbol,
          amount: amt,
          precision: selectedHe.precision,
          memo: DONATION_MEMO,
        });
        toast.success(`Thank you! Donation of ${amt} ${selectedHe.symbol} broadcast.`);
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Donation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0">
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="flex items-center gap-3 px-6 pb-2 pt-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Heart className="size-5 fill-current" />
          </div>
          <DialogTitle className="text-xl font-bold">Support HiveX PH</DialogTitle>
        </div>

        <div className="space-y-4 px-6 pb-6">
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            HiveX PH is built and maintained by the community. A small tip in
            HIVE, HBD, or any Hive Engine token helps cover hosting and keeps new
            features shipping. Every contribution is appreciated 💜
          </DialogDescription>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background p-1">
            {(["hive", "he"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "hive" ? "HIVE" : "Hive Engine"}
              </button>
            ))}
          </div>

          {tab === "hive" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Currency
                </label>
                <Select value={hiveCurrency} onValueChange={(v) => setHiveCurrency(v as HiveCurrency)}>
                  <SelectTrigger className="h-11 rounded-lg border-border/60 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["HIVE", "HBD"] as HiveCurrency[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount ({hiveCurrency})
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  placeholder="0.000"
                  value={hiveAmount}
                  onChange={(e) => setHiveAmount(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border/60 bg-background px-3 font-mono text-sm outline-none focus:border-primary"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Token
                </label>
                <TokenPicker
                  tokens={hePickerItems}
                  value={heSymbol}
                  onSelect={setHeSymbol}
                  placeholder="Select a token"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.00000001"
                  placeholder="0.00"
                  value={heAmount}
                  onChange={(e) => setHeAmount(e.target.value)}
                  className="h-11 w-full rounded-lg border border-border/60 bg-background px-3 font-mono text-sm outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          {user.isLoggedIn ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleDonate}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary/80 text-sm font-semibold text-primary-foreground transition hover:bg-primary disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Donate with Keychain
            </button>
          ) : (
            <LoginModal>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center rounded-lg bg-primary/80 text-sm font-semibold text-primary-foreground transition hover:bg-primary"
              >
                Sign in to donate
              </button>
            </LoginModal>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            Sending to{" "}
            <span className="font-semibold text-primary">@{recipient}</span> ·
            Memo: <span className="italic">&quot;{DONATION_MEMO}&quot;</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}