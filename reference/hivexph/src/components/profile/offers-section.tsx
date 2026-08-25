
import { useState, useEffect, useRef } from "react";
import {
  Tag, AlertTriangle, Zap, Loader2,
  Pencil, Trash2, Check, X, Clock, Sparkles, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateOfferDialog } from "@/components/create-offer-dialog";
import { MerchantSetupWizard } from "@/components/profile/merchant-setup-wizard";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { useAxios, jsonFetcher } from "@/hooks/useAxios";
import type { OfferEntry } from "@/lib/context/schemas";
import type { OffersActivated } from "@/lib/context/schemas";
import { ACTIVATION_CONFIG } from '@/lib/config/config'
import { HIVE_CONFIG } from '@/lib/config/api';

interface OffersSectionProps {
  username:              string;
  isOwner:               boolean;
  initialBuy:            OfferEntry[];
  initialSell:           OfferEntry[];
  initialPaymentMethods: string[];
  initialActivation:     OffersActivated | null;
  merchantAccount?:      string;
}

function formatFiat(n: number) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function isActivationLive(activation: OffersActivated | null): boolean {
  if (!activation) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= activation.time_started && nowSec <= activation.time_ended;
}

// ── Inline edit state for a single row ───────────────────────────────────────
interface EditDraft {
  side:  "buy" | "sell";
  index: number;
  price:    string;
  limitMin: string;
  limitMax: string;
  token:    string;
}

export function OffersSection({
  username,
  isOwner,
  initialBuy,
  initialSell,
  initialPaymentMethods,
  initialActivation,
  merchantAccount,
}: OffersSectionProps) {
  const [buy,            setBuy]            = useState<OfferEntry[]>(initialBuy);
  const [sell,           setSell]           = useState<OfferEntry[]>(initialSell);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(initialPaymentMethods);
  const [merchantUrl,    setMerchantUrl]    = useState<string>(merchantAccount ?? "");
  const [activation,     setActivation]     = useState<OffersActivated | null>(initialActivation);
  const [isActivating,   setIsActivating]   = useState(false);
  const [activateError,  setActivateError]  = useState<string | null>(null);
  const [countdown,      setCountdown]      = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // wizard control
  const [wizardOpen, setWizardOpen]   = useState(false);
  const [wizardStep, setWizardStep]   = useState(0);

  // edit / remove per-row state
  const [editDraft,   setEditDraft]   = useState<EditDraft | null>(null);
  const [savingIndex, setSavingIndex] = useState<string | null>(null); // "buy-0", "sell-1" …
  const [rowError,    setRowError]    = useState<string | null>(null);

  const { activateOffers, updateOffers } = useHiveKeychain();
  const { get, api } = useAxios();

  const allOffers          = [...buy, ...sell];
  const hasOffers          = allOffers.length > 0;
  const hasPaymentMethods  = paymentMethods.length > 0;
  const hasMerchantAccount = !!(merchantUrl?.trim());
  const isActive           = isActivationLive(activation);

  // ── Eligibility checklist ──────────────────────────────────────────────────
  const eligibility = [
    { label: "Payment methods",  done: hasPaymentMethods,  step: 2 },
    { label: "Merchant post",    done: hasMerchantAccount, step: 3 },
  ];
  const completedCount = eligibility.filter((e) => e.done).length;
  const isEligible     = completedCount === eligibility.length;
  const firstIncompleteStep = eligibility.find((e) => !e.done)?.step ?? 0;

  function openWizardAt(stepIndex: number) {
    setWizardStep(stepIndex);
    setWizardOpen(true);
  }

  // ── Activate offers ─────────────────────────────────────────────────────────
  async function handleActivate() {
    setActivateError(null);
    setIsActivating(true);
    try {
      await activateOffers(username);
      await new Promise((r) => setTimeout(r, 2000));
      await refreshFromChain();
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : "Activation failed.");
    } finally {
      setIsActivating(false);
    }
  }

  // ── Remove a single offer by index ─────────────────────────────────────────
  async function handleRemove(side: "buy" | "sell", index: number) {
    const key = `${side}-${index}`;
    setSavingIndex(key);
    setRowError(null);
    try {
      const newBuy  = side === "buy"  ? buy.filter((_, i) => i !== index)  : buy;
      const newSell = side === "sell" ? sell.filter((_, i) => i !== index) : sell;
      await updateOffers(username, { buy: newBuy, sell: newSell });
      setBuy(newBuy);
      setSell(newSell);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to remove offer.");
    } finally {
      setSavingIndex(null);
    }
  }

  // ── Begin editing a row ─────────────────────────────────────────────────────
  function startEdit(side: "buy" | "sell", index: number, offer: OfferEntry) {
    setRowError(null);
    setEditDraft({
      side, index,
      price:    String(offer.price),
      limitMin: String(offer.limit.min),
      limitMax: String(offer.limit.max),
      token:    offer.token,
    });
  }

  // ── Save an edited row ──────────────────────────────────────────────────────
  async function handleSaveEdit() {
    if (!editDraft) return;
    const { side, index, price, limitMin, limitMax, token } = editDraft;

    const p   = parseFloat(price);
    const min = parseFloat(limitMin);
    const max = parseFloat(limitMax);
    if (!p || p <= 0)       return setRowError("Price must be a positive number.");
    if (!min || min <= 0)   return setRowError("Min limit must be positive.");
    if (!max || max <= min) return setRowError("Max limit must be greater than min.");

    const key = `${side}-${index}`;
    setSavingIndex(key);
    setRowError(null);

    try {
      const updated: OfferEntry = {
        price: p,
        limit: { min, max },
        token,
        payment_methods: side === "buy"
          ? (buy[index]?.payment_methods ?? paymentMethods)
          : (sell[index]?.payment_methods ?? paymentMethods),
      };

      const newBuy  = side === "buy"
        ? buy.map((o, i)  => (i === index ? updated : o))
        : buy;
      const newSell = side === "sell"
        ? sell.map((o, i) => (i === index ? updated : o))
        : sell;

      await updateOffers(username, { buy: newBuy, sell: newSell });
      setBuy(newBuy);
      setSell(newSell);
      setEditDraft(null);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSavingIndex(null);
    }
  }

  // ── Refresh from chain ──────────────────────────────────────────────────────
  async function refreshFromChain() {
    try {
      // Re-fetch offers from metadata (direct Hive RPC — external node)
      const data = await jsonFetcher<{ result?: Array<{ posting_json_metadata?: string }> }>(
        HIVE_CONFIG.apiUrl,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: 1, jsonrpc: "2.0",
            method: "condenser_api.get_accounts",
            params: [[username]],
          }),
        },
      );
      const account = data?.result?.[0];
      if (!account) return;

      const meta   = JSON.parse(account.posting_json_metadata ?? "{}");
      const offers = meta?.offers as { buy?: OfferEntry[]; sell?: OfferEntry[] } | undefined;
      if (Array.isArray(offers?.buy))           setBuy(offers!.buy!);
      if (Array.isArray(offers?.sell))          setSell(offers!.sell!);
      if (Array.isArray(meta?.payment_methods)) setPaymentMethods(meta.payment_methods as string[]);
      const contact = (meta?.contact ?? {}) as Record<string, string>;
      if (typeof contact.merchant_account === "string") setMerchantUrl(contact.merchant_account);

      // Always resolve activation from the transfer history via the API route —
      // it is NOT stored in metadata and must be derived from account_history.
      const actData = await get<{ active: boolean; time_started?: number; time_ended?: number }>(
        api.p2pActivation(username),
      );
      if (actData.active && actData.time_started != null && actData.time_ended != null) {
        setActivation({ time_started: actData.time_started, time_ended: actData.time_ended });
      } else {
        setActivation(null);
      }
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    refreshFromChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // ── Live countdown ticker ────────────────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!activation) {
      setCountdown(null);
      return;
    }

    function tick() {
      const nowSec     = Math.floor(Date.now() / 1000);
      const remaining  = (activation?.time_ended ?? 0) - nowSec;
      if (remaining <= 0) {
        setCountdown(null);
        setActivation(null);
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setCountdown(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }

    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activation]);

  // ── Render a single offer row (Desktop) ────────────────────────────────────
  function OfferRow({
    offer,
    side,
    index,
  }: {
    offer: OfferEntry;
    side: "buy" | "sell";
    index: number;
  }) {
    const key       = `${side}-${index}`;
    const isEditing = editDraft?.side === side && editDraft?.index === index;
    const isSaving  = savingIndex === key;

    if (isEditing && editDraft) {
      return (
        <tr className="border-b border-border/40 bg-muted/20">
          {/* Type badge */}
          <td className="px-4 py-3">
            <Badge
              variant="outline"
              className={
                side === "buy"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/10 text-[10px] font-bold text-rose-400"
              }
            >
              {side.toUpperCase()}
            </Badge>
          </td>
          {/* Token — not editable */}
          <td className="px-4 py-3 font-mono font-semibold text-xs text-foreground">{offer.token}</td>
          {/* Price */}
          <td className="px-4 py-3">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-sans text-xs text-muted-foreground">₱</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={editDraft.price}
                onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
                className="h-8 w-28 pl-6 font-mono text-xs"
              />
            </div>
          </td>
          {/* Limits */}
          <td className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 font-sans text-[10px] text-muted-foreground">Min</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={editDraft.limitMin}
                  onChange={(e) => setEditDraft({ ...editDraft, limitMin: e.target.value })}
                  className="h-8 w-24 pl-7 font-mono text-xs"
                  placeholder="Min"
                />
              </div>
              <span className="text-muted-foreground text-xs">–</span>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 font-sans text-[10px] text-muted-foreground">Max</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={editDraft.limitMax}
                  onChange={(e) => setEditDraft({ ...editDraft, limitMax: e.target.value })}
                  className="h-8 w-24 pl-8 font-mono text-xs"
                  placeholder="Max"
                />
              </div>
            </div>
          </td>
          {/* Payment — not editable inline, just show current */}
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {(offer.payment_methods?.length ? offer.payment_methods : paymentMethods).map((pm) => (
                <span
                  key={pm}
                  className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {pm}
                </span>
              ))}
            </div>
          </td>
          {/* Actions */}
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                disabled={isSaving}
                onClick={handleSaveEdit}
                title="Save changes"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                disabled={isSaving}
                onClick={() => { setEditDraft(null); setRowError(null); }}
                title="Cancel"
              >
                <X className="size-4" />
              </Button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr className="group border-b border-border/30 transition-colors hover:bg-accent/10">
        <td className="px-4 py-3.5">
          <Badge
            variant="outline"
            className={
              side === "buy"
                ? "border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-400"
                : "border-rose-500/40 bg-rose-500/10 text-[10px] font-bold text-rose-400"
            }
          >
            {side.toUpperCase()}
          </Badge>
        </td>
        <td className="px-4 py-3.5 font-mono font-semibold text-xs text-foreground">{offer.token}</td>
        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-foreground">₱{formatFiat(offer.price)}</td>
        <td className="px-4 py-3.5 font-mono text-xs text-foreground">
          ₱{offer.limit.min.toLocaleString()} &ndash; ₱{offer.limit.max.toLocaleString()}
        </td>
        <td className="px-4 py-3.5">
          <div className="flex flex-wrap gap-1">
            {(offer.payment_methods?.length ? offer.payment_methods : paymentMethods).map((pm) => (
              <span
                key={pm}
                className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {pm}
              </span>
            ))}
          </div>
        </td>
        {isOwner ? (
          <td className="px-4 py-3.5 text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                disabled={!!savingIndex}
                onClick={() => startEdit(side, index, offer)}
                title="Edit offer"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                disabled={!!savingIndex}
                onClick={() => handleRemove(side, index)}
                title="Remove offer"
              >
                {savingIndex === key ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </div>
          </td>
        ) : (
          <td className="px-4 py-3.5" />
        )}
      </tr>
    );
  }

  // ── Render a single offer card (Mobile) ─────────────────────────────────────
  function OfferCardMobile({
    offer,
    side,
    index,
  }: {
    offer: OfferEntry;
    side: "buy" | "sell";
    index: number;
  }) {
    const key       = `${side}-${index}`;
    const isEditing = editDraft?.side === side && editDraft?.index === index;
    const isSaving  = savingIndex === key;

    if (isEditing && editDraft) {
      return (
        <div className="rounded-2xl border border-primary/30 bg-muted/20 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={
                side === "buy"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/10 text-[10px] font-bold text-rose-400"
              }
            >
              {side.toUpperCase()}
            </Badge>
            <span className="font-mono font-bold text-xs text-foreground">{offer.token}</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Rate (PHP)</label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-sans text-xs text-muted-foreground">₱</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={editDraft.price}
                  onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
                  className="h-9 pl-6 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Limits (PHP)</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-sans text-[10px] text-muted-foreground">Min</span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={editDraft.limitMin}
                    onChange={(e) => setEditDraft({ ...editDraft, limitMin: e.target.value })}
                    className="h-9 pl-7 font-mono text-xs"
                    placeholder="Min"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-sans text-[10px] text-muted-foreground">Max</span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={editDraft.limitMax}
                    onChange={(e) => setEditDraft({ ...editDraft, limitMax: e.target.value })}
                    className="h-9 pl-8 font-mono text-xs"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled={isSaving}
              onClick={() => { setEditDraft(null); setRowError(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={isSaving}
              onClick={handleSaveEdit}
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                side === "buy"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-400"
                  : "border-rose-500/40 bg-rose-500/10 text-[10px] font-bold text-rose-400"
              }
            >
              {side.toUpperCase()}
            </Badge>
            <span className="font-mono font-bold text-sm text-foreground">{offer.token}</span>
          </div>
          
          {isOwner && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                disabled={!!savingIndex}
                onClick={() => startEdit(side, index, offer)}
                title="Edit offer"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                disabled={!!savingIndex}
                onClick={() => handleRemove(side, index)}
                title="Remove offer"
              >
                {savingIndex === key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Rate (PHP)</p>
            <p className="mt-1 font-mono text-base font-bold text-foreground">₱{formatFiat(offer.price)}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Limits (PHP)</p>
            <p className="mt-1 font-mono text-[12px] font-medium text-foreground">
              ₱{offer.limit.min.toLocaleString()} – ₱{offer.limit.max.toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Payment Methods</p>
          <div className="flex flex-wrap gap-1">
            {(offer.payment_methods?.length ? offer.payment_methods : paymentMethods).map((pm) => (
              <span
                key={pm}
                className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {pm}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-8 md:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Active offers</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {allOffers.length} offer{allOffers.length !== 1 ? "s" : ""}
          </Badge>
          {isOwner && isEligible && (
            <CreateOfferDialog
              username={username}
              onCreated={refreshFromChain}
              hasPaymentMethods={hasPaymentMethods}
              disabled={!hasMerchantAccount}
            />
          )}
          {isOwner && !isEligible && (
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => openWizardAt(firstIncompleteStep)}
            >
              <Sparkles className="size-3.5" />
              Complete setup
            </Button>
          )}
        </div>
      </div>

      {/* Eligibility wizard card */}
      {isOwner && !isEligible && (
        <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  You're {completedCount} of {eligibility.length} steps from creating offers
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Finish the setup wizard to unlock merchant features.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => openWizardAt(firstIncompleteStep)}
            >
              Continue setup
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${(completedCount / eligibility.length) * 100}%` }}
            />
          </div>
          {/* Checklist */}
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {eligibility.map((e) => (
              <li
                key={e.label}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      e.done
                        ? "flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
                        : "flex size-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground"
                    }
                  >
                    {e.done ? <Check className="size-3" /> : null}
                  </span>
                  <span
                    className={
                      e.done
                        ? "text-xs font-medium text-foreground"
                        : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    {e.label}
                  </span>
                </div>
                {!e.done && (
                  <button
                    type="button"
                    onClick={() => openWizardAt(e.step)}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Fix
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mount wizard */}
      {isOwner && (
        <MerchantSetupWizard
          username={username}
          hideTrigger
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          startStep={wizardStep}
          onComplete={refreshFromChain}
        />
      )}

      {/* Activation warning + button */}
      {isOwner && hasOffers && !isActive && (
        <div className="space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-400" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-medium text-orange-300/90">
                Your offers are not visible in the marketplace yet.
              </p>
              <p className="text-[11px] text-orange-300/70">
                Pay {ACTIVATION_CONFIG.activationLabel} to activate your listing for{" "}
                {ACTIVATION_CONFIG.windowHours} hours. Keychain will prompt you to confirm
                the metadata update and the HIVE transfer to{" "}
                <span className="font-mono font-semibold">@{ACTIVATION_CONFIG.watchAccount}</span>.
              </p>
            </div>
          </div>
          {activateError && (
            <p className="pl-6 text-[11px] text-rose-400">{activateError}</p>
          )}
          <div className="pl-6">
            <Button
              size="sm"
              className="h-8 gap-2 text-[12px]"
              disabled={isActivating}
              onClick={handleActivate}
            >
              {isActivating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Activating…
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Activate for {ACTIVATION_CONFIG.activationLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Active — countdown banner */}
      {isActive && countdown && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <Clock className="size-4 shrink-0 text-emerald-400" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] text-emerald-300/90">
              Listing active — shuts down in
            </span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-emerald-300">
              {countdown}
            </span>
          </div>
        </div>
      )}

      {/* Row-level error */}
      {rowError && (
        <p className="text-[12px] text-rose-400">{rowError}</p>
      )}

      <Card className="border-border/60 bg-card/40 overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            {isActive
              ? "Offers are live in the marketplace"
              : "Offers are currently inactive"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          {allOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <Tag className="mb-3 size-9 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No offers yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {isOwner
                  ? "Create your first buy or sell offer above."
                  : "This user has not published any offers yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-card/40">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Token</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Rate (PHP)</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Limit (PHP)</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Payment</th>
                      {isOwner && <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {buy.map((o, i) => (
                      <OfferRow key={`buy-${i}`} offer={o} side="buy" index={i} />
                    ))}
                    {sell.map((o, i) => (
                      <OfferRow key={`sell-${i}`} offer={o} side="sell" index={i} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 px-4 pb-4 lg:hidden">
                {buy.map((o, i) => (
                  <OfferCardMobile key={`buy-${i}`} offer={o} side="buy" index={i} />
                ))}
                {sell.map((o, i) => (
                  <OfferCardMobile key={`sell-${i}`} offer={o} side="sell" index={i} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
