
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { P2P_TOKEN_SYMBOLS } from "@/lib/config/config";
import { offerFormSchema, type OfferFormValues, type OfferEntry } from "@/lib/context/schemas";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { fetchPostingJsonMeta } from '@/lib/fetchers/hive-account-helpers';

interface CreateOfferDialogProps {
  username: string;
  /** Whether the user has at least one payment method set. */
  hasPaymentMethods: boolean;
  /** Hard-disables the trigger (e.g. merchant account post not yet set). */
  disabled?: boolean;
  /** Called after a successful broadcast so the parent can refresh the list */
  onCreated?: () => void;
}

const TOKENS = P2P_TOKEN_SYMBOLS;

const EMPTY: OfferFormValues = {
  side:     "buy",
  token:    "HIVE",
  price:    0,
  limitMin: 0,
  limitMax: 0,
};

type FieldErrors = Partial<Record<keyof OfferFormValues | "root", string>>;

export function CreateOfferDialog({ username, hasPaymentMethods, disabled, onCreated }: CreateOfferDialogProps) {
  const { updateOffers } = useHiveKeychain();
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<OfferFormValues>(EMPTY);
  const [errors, setErrors]   = useState<FieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function set<K extends keyof OfferFormValues>(key: K, value: OfferFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const result = offerFormSchema.safeParse(form);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(
          Object.entries(flat).map(([k, msgs]) => [k, msgs?.[0]]),
        ),
      );
      return;
    }
    setErrors({});
    setIsSaving(true);

    try {
      const { side, token, price, limitMin, limitMax } = result.data;

      // 1. Read current offers from chain
      const meta         = await fetchPostingJsonMeta(username);
      const existing     = (meta.offers ?? { buy: [], sell: [] }) as {
        buy:  OfferEntry[];
        sell: OfferEntry[];
      };
      const buy  = Array.isArray(existing.buy)  ? existing.buy  : [];
      const sell = Array.isArray(existing.sell) ? existing.sell : [];

      // 2a. Block duplicate — same side + same token already exists
      const targetList = side === "buy" ? buy : sell;
      const duplicate  = targetList.some(
        (o) => o.token.toUpperCase() === token.toUpperCase(),
      );
      if (duplicate) {
        setErrors({ root: `You already have a ${side} offer for ${token}. Edit or remove it first.` });
        setIsSaving(false);
        return;
      }

      // 3. Append new entry to the correct side
      const newEntry: OfferEntry = {
        price,
        limit: { min: limitMin, max: limitMax },
        token,
        payment_methods: [],
      };

      const updatedOffers = {
        buy:  side === "buy"  ? [...buy,  newEntry] : buy,
        sell: side === "sell" ? [...sell, newEntry] : sell,
      };

      // 4. Broadcast
      await updateOffers(username, updatedOffers);

      setForm(EMPTY);
      setOpen(false);
      onCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setErrors({ root: msg });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div
        title={
          disabled
            ? "Set up your merchant account post in account settings before creating an offer."
            : !hasPaymentMethods
            ? "Add at least one payment method in account settings before creating an offer."
            : undefined
        }
      >
        <Button
          size="sm"
          className="gap-1.5"
          disabled={disabled || !hasPaymentMethods}
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5" />
          Create offer
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create offer</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Side selector */}
            <div className="space-y-1.5">
              <Label>Side</Label>
              <div className="flex gap-2">
                {(["buy", "sell"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("side", s)}
                    className={cn(
                      "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
                      form.side === s
                        ? s === "buy"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-rose-500 bg-rose-500/10 text-rose-400"
                        : "border-border bg-transparent text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Token */}
            <div className="space-y-1.5">
              <Label htmlFor="offer-token">Token</Label>
              <Select value={form.token} onValueChange={(v) => set("token", v ?? "HIVE")}>
                <SelectTrigger id="offer-token" className="font-mono">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map((t) => (
                    <SelectItem key={t} value={t} className="font-mono">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.token && (
                <p className="text-xs text-destructive">{errors.token}</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="offer-price">Price per token (PHP)</Label>
              <Input
                id="offer-price"
                type="number"
                min={0}
                step="any"
                value={form.price || ""}
                onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                placeholder="e.g. 18.50"
                className="font-mono"
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price}</p>
              )}
            </div>

            {/* Limits */}
            <div className="space-y-1.5">
              <Label>Order limits (PHP)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.limitMin || ""}
                  onChange={(e) => set("limitMin", parseFloat(e.target.value) || 0)}
                  placeholder="Min"
                  className="font-mono"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.limitMax || ""}
                  onChange={(e) => set("limitMax", parseFloat(e.target.value) || 0)}
                  placeholder="Max"
                  className="font-mono"
                />
              </div>
              {(errors.limitMin || errors.limitMax) && (
                <p className="text-xs text-destructive">
                  {errors.limitMin ?? errors.limitMax}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {errors.root && (
              <p className="mr-auto text-xs text-destructive">{errors.root}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Waiting for Keychain\u2026" : "Publish offer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
