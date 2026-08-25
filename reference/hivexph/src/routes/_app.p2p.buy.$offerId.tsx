import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import useSWR from "swr";
import {
  ArrowLeft,
  ShieldCheck,
  MessageCircle,
  Send,
  CreditCard,
  ArrowRight,
  Loader2,
  Star,
  Clock,
  Zap,
  Facebook,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BuyOrderForm } from "@/components/p2p/buy-order-form";
import {
  hiveAvatarUrl,
  parseHiveContacts,
  getHiveAccount,
} from "@/lib/fetchers/hive-account-helpers";
import { HIVE_CONFIG } from "@/lib/config/api";
import type { LiveOffer } from "@/lib/fetchers/p2p";

const appRoute = getRouteApi("/_app");

export const Route = createFileRoute("/_app/p2p/buy/$offerId")({
  head: ({ params }) => ({
    meta: [
      { title: `Trade offer ${params.offerId} — HiveX PH` },
      {
        name: "description",
        content: `Trade peer-to-peer crypto with merchant on HiveX PH.`,
      },
    ],
  }),
  component: BuyOfferPage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Offer not found.</p>
  ),
});

function formatPrice(price: number) {
  return price < 1 ? price.toFixed(4) : price.toFixed(2);
}

function BuyOfferPage() {
  const { offerId } = Route.useParams();
  const { user: viewer } = appRoute.useLoaderData();
  const reviewerUsername = viewer.isLoggedIn ? viewer.username : "";

  const { data, error, isLoading } = useSWR<{ offer: LiveOffer }>(
    `/api/public/p2p/offers/${offerId}`,
    (url: string) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  );

  const offer = data?.offer;

  const { data: merchantAccount } = useSWR(
    offer ? ["hive-account", offer.merchant] : null,
    () => (offer ? getHiveAccount(offer.merchant) : null),
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (error || !offer) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        Offer not found or no longer active.
      </div>
    );
  }

  const contacts = merchantAccount ? parseHiveContacts(merchantAccount) : {};
  const isBuy = offer.side === "buy";
  const initials = offer.merchant.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between pt-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Link to="/p2p">
            <ArrowLeft className="size-3.5" />
            Back to offers
          </Link>
        </Button>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Order ID · {offerId}
        </div>
      </div>

      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,theme(colors.primary/15),transparent_60%)]" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/40 to-transparent blur" />
              <div className="relative size-16 overflow-hidden rounded-full border border-primary/30 bg-muted">
                <div
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center text-base font-semibold text-foreground"
                >
                  {initials}
                </div>
                <img
                  src={hiveAvatarUrl(offer.merchant)}
                  alt={offer.merchant}
                  className="relative size-full object-cover"
                  onError={(e) =>
                    ((e.currentTarget as HTMLImageElement).style.display = "none")
                  }
                />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  @{offer.merchant}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400">
                  <ShieldCheck className="size-2.5" />
                  Verified
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wider",
                    isBuy
                      ? "border-success/40 text-success"
                      : "border-destructive/40 text-destructive",
                  )}
                >
                  {isBuy ? "Buy order" : "Sell order"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Trade {offer.token} directly with a verified Filipino merchant.
                Non-custodial · Zero platform fees.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-3 fill-warning text-warning" />
                  New merchant
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3" />
                  Avg response · 15 min
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="size-3" />
                  On-chain settlement
                </span>
              </div>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
          >
            <Link
              to="/profile/$username"
              params={{ username: offer.merchant }}
            >
              View profile
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>

        {/* Stats strip */}
        <div className="relative grid grid-cols-3 border-t border-border bg-background/40 backdrop-blur">
          <div className="border-r border-border px-6 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Price
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              ₱{formatPrice(offer.price)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              PHP / {offer.token}
            </div>
          </div>
          <div className="border-r border-border px-6 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Limits
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">
              ₱{offer.minLimit.toLocaleString()} – ₱
              {offer.maxLimit.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Per transaction
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Token
            </div>
            <div className="mt-1 text-base font-semibold text-foreground">
              {offer.token}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Settled on Hive
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* LEFT — Order form */}
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard className="size-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Place your order
            </h2>
          </div>
          <p className="mb-4 text-[12px] text-muted-foreground">
            Enter the amount you want to trade, then reach out to the merchant
            directly via Facebook, Telegram, or Discord to coordinate payment.
          </p>
          <BuyOrderForm
            offer={offer}
            reviewerUsername={reviewerUsername}
            merchantPermlink={contacts.merchant_account ?? ""}
          />
        </section>

        {/* RIGHT — Sidebar */}
        <aside className="space-y-6">
          {/* Contact */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Contact merchant
              </h2>
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Message the merchant on their preferred channel to arrange the
              trade. All payments happen off-platform between you and the
              merchant.
            </p>
            <div className="grid gap-2">
              {contacts.facebook && (
                <a
                  href={contacts.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 text-[13px] transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10">
                    <Facebook className="size-3.5 text-[#1877F2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">Facebook</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {contacts.facebook.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </a>
              )}

              {contacts.telegram && (
                <a
                  href={`https://t.me/${contacts.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 text-[13px] transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#229ED9]/10">
                    <Send className="size-3.5 text-[#229ED9]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Telegram</p>
                    <p className="text-[11px] text-muted-foreground">
                      {contacts.telegram}
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </a>
              )}

              {contacts.discord && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 text-[13px]">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#5865F2]/10">
                    <MessageCircle className="size-3.5 text-[#5865F2]" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Discord</p>
                    <p className="select-all text-[11px] text-muted-foreground">
                      {contacts.discord}
                    </p>
                  </div>
                </div>
              )}

              {!contacts.facebook &&
                !contacts.telegram &&
                !contacts.discord && (
                  <a
                    href={`${HIVE_CONFIG.peakdUrl}/@${offer.merchant}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 text-[13px] transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Send className="size-3.5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        Message on Hive
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        @{offer.merchant}
                      </p>
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </a>
                )}
            </div>
          </div>

          {/* Safety */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Trade safely
              </h2>
            </div>
            <ul className="space-y-3 text-[12px] text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                Always confirm payment received in your bank or e-wallet app
                before sending tokens.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                Never share your Hive keys, OTPs, or wallet PIN — HiveX support
                will never ask for them.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                Only use the contact channels listed on the merchant's profile.
                Reject last-minute changes.
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <Separator />
    </div>
  );
}
