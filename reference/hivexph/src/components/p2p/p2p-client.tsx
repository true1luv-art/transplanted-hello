import { useMemo, useState } from "react";
import useSWR from "swr";
import { Link } from "@tanstack/react-router";
import { Search, ArrowRight, Store, Loader2, Repeat2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { LiveOffer } from "@/lib/fetchers/p2p";
import { P2P_TOKENS, PAYMENT_METHODS } from "@/lib/config/config";

const TOKENS = [
  { value: "ALL", label: "All Tokens" },
  ...P2P_TOKENS.map((t) => ({ value: t.symbol, label: t.symbol })),
];
const PAYMENT_FILTER = ["All", ...PAYMENT_METHODS];

function formatPrice(price: number) {
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
}

function fmt(n: number, decimals = 0): string {
  if (!isFinite(n) || n === 0) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

// Stable per-merchant gradient — purely cosmetic.
const GRADIENTS = [
  "from-rose-500 to-amber-500",
  "from-blue-500 to-purple-500",
  "from-emerald-500 to-cyan-500",
  "from-indigo-500 to-fuchsia-500",
  "from-orange-500 to-red-500",
  "from-teal-500 to-sky-500",
];
function gradientFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load offers");
    return r.json() as Promise<{ offers: LiveOffer[] }>;
  });

interface Props {
  username: string;
  isLoggedIn: boolean;
}

type Tab = "buy" | "sell";

export default function P2PPageClient({ username, isLoggedIn }: Props) {
  const [tab, setTab] = useState<Tab>("buy");
  const [token, setToken] = useState("ALL");
  const [payment, setPayment] = useState("All");
  const [amountInput, setAmountInput] = useState("");

  const { data, error, isLoading } = useSWR(
    "/api/public/p2p/offers",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  const offers = data?.offers ?? [];

  const stats = useMemo(() => {
    const buy = offers.filter((o) => o.side === "buy").length;
    const sell = offers.filter((o) => o.side === "sell").length;
    const merchants = new Set(offers.map((o) => o.merchant)).size;
    const tokens = new Set(offers.map((o) => o.token)).size;
    return { total: offers.length, buy, sell, merchants, tokens };
  }, [offers]);

  const filtered = offers.filter((o) => {
    if (o.side !== tab) return false;
    if (token !== "ALL" && o.token !== token) return false;
    if (payment !== "All" && !o.paymentMethods.includes(payment)) return false;
    if (amountInput) {
      const amt = parseFloat(amountInput);
      if (!isNaN(amt) && (amt < o.minLimit || amt > o.maxLimit)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Repeat2}
        title="Buy & Sell Crypto"
        description="Browse peer-to-peer offers and trade directly with merchants."
        stats={[
          { label: "Active Offers", value: fmt(stats.total) },
          { label: "Buy Offers", value: fmt(stats.buy) },
          { label: "Sell Offers", value: fmt(stats.sell) },
          { label: "Merchants", value: fmt(stats.merchants) },
        ]}
      />

      {isLoggedIn && (
        <Link
          to="/profile/$username"
          params={{ username }}
          className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-accent/30"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Store className="size-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">My Offers</p>
              <p className="text-[11px] text-muted-foreground">
                Manage your buy &amp; sell offers from your profile.
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60">
        <TabBtn active={tab === "buy"} onClick={() => setTab("buy")}>
          Buy
          <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-success">
            {stats.buy}
          </span>
        </TabBtn>
        <TabBtn active={tab === "sell"} onClick={() => setTab("sell")}>
          Sell
          <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
            {stats.sell}
          </span>
        </TabBtn>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Amount (PHP)"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="h-10 w-44 rounded-xl border-border/60 pl-9 text-[13px]"
          />
        </div>

        <Select value={token} onValueChange={(v) => setToken(v ?? "ALL")}>
          <SelectTrigger className="h-10 w-44 rounded-xl border-border/60 text-[13px]">
            <span className="mr-1 shrink-0 text-[11px] font-medium text-muted-foreground">
              Token:
            </span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOKENS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-[13px]">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={payment} onValueChange={(v) => setPayment(v ?? "All")}>
          <SelectTrigger className="h-10 w-52 rounded-xl border-border/60 text-[13px]">
            <span className="mr-1 shrink-0 text-[11px] font-medium text-muted-foreground">
              Payment:
            </span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_FILTER.map((p) => (
              <SelectItem key={p} value={p} className="text-[13px]">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table — desktop */}
      <div className="hidden overflow-hidden rounded-lg border border-border/60 bg-card/20 lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-card/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Advertiser</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Limit (PHP)</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Payment</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground uppercase tracking-wider text-[11px]">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 animate-pulse rounded-full bg-muted/30" />
                        <div className="space-y-1">
                          <div className="h-3 w-24 animate-pulse rounded bg-muted/30" />
                          <div className="h-2.5 w-12 animate-pulse rounded bg-muted/20" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 w-20 animate-pulse rounded bg-muted/30" />
                      </td>
                    ))}
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="Couldn’t load offers"
                      body="Check your connection and try again."
                      tone="destructive"
                    />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="No offers available right now"
                      body="Try adjusting the amount, token, or payment method — or check back soon."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((offer) => (
                  <OfferRow key={offer.id} offer={offer} side={tab} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards — mobile */}
      <div className="space-y-3 lg:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-muted/30" />
          ))
        ) : error ? (
          <EmptyState
            title="Couldn’t load offers"
            body="Check your connection and try again."
            tone="destructive"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No offers available right now"
            body="Try adjusting the amount, token, or payment method — or check back soon."
          />
        ) : (
          filtered.map((offer) => (
            <OfferCard key={offer.id} offer={offer} side={tab} />
          ))
        )}
      </div>
    </div>
  );
}

function OfferCard({ offer, side }: { offer: LiveOffer; side: Tab }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-tr text-[11px] font-bold uppercase text-white",
            gradientFor(offer.merchant),
          )}
        >
          <span aria-hidden>{offer.merchant.slice(0, 2)}</span>
          <img
            src={`https://images.hive.blog/u/${offer.merchant}/avatar`}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {offer.merchant}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {offer.token}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[15px] font-bold text-foreground">
            ₱{formatPrice(offer.price)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {offer.currency} / {offer.token}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Limit
          </p>
          <p className="mt-0.5 truncate font-medium text-foreground">
            ₱{offer.minLimit.toLocaleString()} – ₱{offer.maxLimit.toLocaleString()}
          </p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Payment
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {offer.paymentMethods.length > 0 ? (
              offer.paymentMethods.slice(0, 3).map((pm) => (
                <span
                  key={pm}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                >
                  {pm}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground/50">—</span>
            )}
          </div>
        </div>
      </div>

      <Link
        to="/p2p/buy/$offerId"
        params={{ offerId: offer.id }}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all",
          side === "buy"
            ? "bg-success text-success-foreground shadow-lg shadow-success/20 hover:bg-success/90"
            : "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90",
        )}
      >
        {side === "buy" ? "Buy" : "Sell"} {offer.token}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center px-4 py-2.5 text-sm font-bold transition-colors",
        active
          ? "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function OfferRow({ offer, side }: { offer: LiveOffer; side: Tab }) {
  return (
    <tr className="border-b border-border/30 transition-colors hover:bg-accent/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-tr text-[11px] font-bold uppercase text-white",
              gradientFor(offer.merchant),
            )}
          >
            <span aria-hidden>{offer.merchant.slice(0, 2)}</span>
            <img
              src={`https://images.hive.blog/u/${offer.merchant}/avatar`}
              alt=""
              className="absolute inset-0 size-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {offer.merchant}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {offer.token}
            </p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <p className="font-mono font-medium text-foreground">
          ₱{formatPrice(offer.price)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {offer.currency} / {offer.token}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="text-[13px] font-medium text-foreground">
          ₱{offer.minLimit.toLocaleString()} – ₱{offer.maxLimit.toLocaleString()}
        </p>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {offer.paymentMethods.length > 0 ? (
            offer.paymentMethods.map((pm) => (
              <span
                key={pm}
                className="rounded bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {pm}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground/50">—</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <Link
          to="/p2p/buy/$offerId"
          params={{ offerId: offer.id }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-[12px] font-bold transition-all",
            side === "buy"
              ? "bg-success text-success-foreground shadow-lg shadow-success/20 hover:bg-success/90"
              : "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90",
          )}
        >
          {side === "buy" ? "Buy" : "Sell"}
          <ArrowRight className="size-3" />
        </Link>
      </td>
    </tr>
  );
}

function EmptyState({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone?: "destructive";
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {isLoadingIcon()}
      <p
        className={cn(
          "text-[14px] font-medium",
          tone === "destructive" ? "text-destructive" : "text-foreground",
        )}
      >
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[12px] text-muted-foreground/70">
        {body}
      </p>
    </div>
  );
}

function isLoadingIcon() {
  // Tiny decorative dot — keeps empty state composition consistent with other pages.
  return (
    <div className="mb-3 grid size-10 place-items-center rounded-2xl bg-muted/40 text-muted-foreground">
      <Loader2 className="size-4 opacity-50" />
    </div>
  );
}
