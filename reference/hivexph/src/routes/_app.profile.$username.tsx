import { createFileRoute } from "@tanstack/react-router";
import useSWR from "swr";
import { Share2, Send, MessageCircle, Plus, Star } from "lucide-react";

import { ProfileHeader } from "@/components/profile-header";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import { OffersSection } from "@/components/profile/offers-section";
import { ReviewsSection } from "@/components/profile/reviews-section";
import {
  getHiveAccount,
  parseHiveProfile,
  parseHiveContacts,
} from "@/lib/fetchers/hive-account-helpers";
import { getRouteApi } from "@tanstack/react-router";
const appRoute = getRouteApi("/_app");
import type { OfferEntry } from "@/lib/context/schemas";
import type { OffersActivated } from "@/lib/fetchers/p2p";

export const Route = createFileRoute("/_app/profile/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} — HiveX PH` },
      {
        name: "description",
        content: `Hive profile, offers, and reviews for @${params.username}.`,
      },
    ],
  }),
  component: ProfilePage,
  errorComponent: ({ error }) => (
    <p className="py-12 text-center text-destructive">{error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="py-12 text-center text-muted-foreground">Page not found</p>
  ),
});

const contactTypes = [
  {
    key: "facebook" as const,
    label: "Facebook",
    icon: Share2,
    accent: "text-blue-400 bg-blue-500/10",
    placeholder: "https://facebook.com/yourprofile",
    href: (val: string) => val,
  },
  {
    key: "telegram" as const,
    label: "Telegram",
    icon: Send,
    accent: "text-cyan-400 bg-cyan-500/10",
    placeholder: "@your_handle",
    href: (val: string) => `https://t.me/${val.replace(/^@/, "")}`,
  },
  {
    key: "discord" as const,
    label: "Discord",
    icon: MessageCircle,
    accent: "text-indigo-400 bg-indigo-500/10",
    placeholder: "username#0000",
    href: null,
  },
];

interface ActivationResponse {
  active: boolean;
  time_started?: number;
  time_ended?: number;
}

function ProfilePage() {
  const { username } = Route.useParams();
  const { user: viewer } = appRoute.useLoaderData();
  const isOwner = viewer.isLoggedIn && viewer.username === username;

  const { data: account } = useSWR(
    ["hive-account", username],
    () => getHiveAccount(username),
    { revalidateOnFocus: false },
  );

  const { data: activationResp } = useSWR<ActivationResponse>(
    `/api/public/p2p/activation/${username}`,
    (url) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  );

  const { data: reviewsResp } = useSWR<{ reviews: Array<{ reviewData: { rating: number } }> }>(
    `/api/public/p2p/reviews/${username}`,
    (url) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false },
  );

  const profile = account ? parseHiveProfile(account) : {};
  const contacts = account ? parseHiveContacts(account) : {};
  const displayName = profile.name ?? account?.name ?? username;
  const about = profile.about ?? "";

  let buyOffers: OfferEntry[] = [];
  let sellOffers: OfferEntry[] = [];
  let paymentMethods: string[] = [];
  if (account) {
    try {
      const meta = JSON.parse(account.posting_json_metadata ?? "{}");
      const offers = meta?.offers as
        | { buy?: unknown[]; sell?: unknown[] }
        | undefined;
      if (Array.isArray(offers?.buy))
        buyOffers = offers.buy as OfferEntry[];
      if (Array.isArray(offers?.sell))
        sellOffers = offers.sell as OfferEntry[];
      if (Array.isArray(meta?.payment_methods))
        paymentMethods = meta.payment_methods as string[];
    } catch {
      /* malformed metadata */
    }
  }

  const activation: OffersActivated | null =
    activationResp?.active &&
    activationResp.time_started != null &&
    activationResp.time_ended != null
      ? {
          time_started: activationResp.time_started,
          time_ended: activationResp.time_ended,
        }
      : null;

  const totalOffers = buyOffers.length + sellOffers.length;
  const memberSince = account?.created
    ? new Date(account.created).getFullYear().toString()
    : "—";

  const reviews = reviewsResp?.reviews ?? [];
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? reviews.reduce((sum, r) => sum + (r.reviewData?.rating ?? 0), 0) / reviewCount
      : 0;

  const reviewsNode = (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-0.5" aria-label={`${avgRating.toFixed(1)} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-3.5 md:size-4 ${
              i < Math.round(avgRating)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground">
        {reviewCount > 0 ? `${avgRating.toFixed(1)} · ${reviewCount}` : "No reviews"}
      </span>
    </div>
  );

  const headerStats = [
    { label: "Active Offers", value: String(totalOffers) },
    { label: "Payment Methods", value: String(paymentMethods.length) },
    {
      label: "Reviews",
      value: "",
      node: reviewsNode,
    },
    { label: "Member Since", value: memberSince },
  ];

  const paymentDots = [
    "bg-rose-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-fuchsia-500",
  ];

  return (
    <div className="space-y-8">
      <ProfileHeader
        username={username}
        displayName={displayName}
        about={about}
        verified={true}
        stats={headerStats}
        extraActions={
          isOwner ? (
            <AccountSettingsModal
              username={username}
              initialName={displayName}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Contact + Payments */}
        <div className="space-y-8 lg:col-span-2">
          <section className="space-y-4">
            <div className="px-1">
              <h2 className="text-xl font-bold text-foreground">
                Contact methods
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only shared with counterparties in active trades.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {contactTypes.map((ct) => {
                const Icon = ct.icon;
                const value = contacts[ct.key] ?? "";
                const isSet = value.trim() !== "";
                return (
                  <div
                    key={ct.key}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-border"
                  >
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ct.accent}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {ct.label}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isSet
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isSet ? "Set" : "Not set"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="px-1">
              <h2 className="text-xl font-bold text-foreground">
                Payment methods
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The payment channels you accept when trading.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 px-1">
              {paymentMethods.map((method, i) => (
                <div
                  key={method}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2"
                >
                  <div
                    className={`size-2.5 rounded-full ${paymentDots[i % paymentDots.length]}`}
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {method}
                  </span>
                </div>
              ))}
              {paymentMethods.length === 0 && !isOwner && (
                <p className="text-sm text-muted-foreground">
                  This merchant hasn't added any payment methods yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Right: Trading Summary */}
        <aside className="lg:col-span-1">
          <div className="rounded-[2rem] border border-border/60 bg-muted/30 p-6 backdrop-blur-sm md:p-8">
            <h3 className="mb-6 text-lg font-bold text-foreground">
              Trading Summary
            </h3>
            <div className="space-y-4 text-sm">
              <Row label="Buy offers" value={String(buyOffers.length)} />
              <Row label="Sell offers" value={String(sellOffers.length)} />
              <Row
                label="Status"
                value={activation ? "Active" : "Inactive"}
                valueClassName={
                  activation ? "text-emerald-400" : "text-muted-foreground"
                }
              />
            </div>
          </div>
        </aside>
      </div>

      <OffersSection
        username={username}
        isOwner={isOwner}
        initialBuy={buyOffers}
        initialSell={sellOffers}
        initialPaymentMethods={paymentMethods}
        initialActivation={activation}
        merchantAccount={contacts.merchant_account}
      />

      <ReviewsSection
        username={username}
        merchantAccount={contacts.merchant_account}
      />
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${valueClassName ?? "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
