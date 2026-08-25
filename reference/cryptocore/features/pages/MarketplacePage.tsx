"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  History,
  Image as ImageIcon,
  PackageSearch,
  RectangleHorizontal,
  RefreshCw,
  Store,
  User,
} from "lucide-react";

import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { EquipmentCard } from "@/components/game/EquipmentCard";
import { MarketSalesHistory } from "@/components/game/MarketSalesHistory";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RARITY_KEYS,
  RARITY_META,
  SLOT_KEYS,
  SLOT_META,
  STAT_KEYS,
} from "@/features/constants/game";
import { getAvatarByTemplateId } from "@/features/templates/avatars";
import { getBannerByTemplateId } from "@/features/templates/banners";
import { getBackgroundByTemplateId } from "@/features/templates/backgrounds";
import { MARKET_FEE } from "@/features/stores/marketplaceStore";
import { useAuthStore } from "@/features/stores/authStore";
import { useHydrated } from "@/hooks/useHydrated";
import { buyMarketItem, cancelMarketListing, getMarketListings } from "@/lib/api/client";
import type { MarketListingDto } from "@/lib/api/types";
import { formatHash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { equipmentScore } from "@/features/game/stats";
import type { Equipment, Rarity, SlotKey, StatRoll } from "@/features/types/game";
import {
  getHashTokenBalance,
  getTreasuryAddress,
  isChainPaymentConfigured,
  payWithHashToken,
} from "@/lib/wallet";

type SortKey = "price" | "score" | "level" | "listed";
type Category = "gear" | "cosmetics";
type CosmeticKind = "avatar" | "banner" | "background";

interface ServerListing {
  id: string;
  kind: "item";
  refId: number;
  item: Equipment;
  price: number;
  seller: string;
  listedAt: number;
}

interface ServerAssetListing {
  id: string;
  kind: "asset";
  refId: number;
  cosmeticKind: CosmeticKind;
  name: string;
  image: string;
  price: number;
  seller: string;
  listedAt: number;
}

/** templateId ranges: avatar 0–99, banner 100–199, background 200+. */
function cosmeticKindForTemplate(templateId: number): CosmeticKind {
  if (templateId < 100) return "avatar";
  if (templateId < 200) return "banner";
  return "background";
}

const COSMETIC_KIND_LABEL: Record<CosmeticKind, string> = {
  avatar: "Avatar",
  banner: "Banner",
  background: "Background",
};

/** Maps a unified MarketListingDto into the shape the equipment card renders. */
function toServerListing(listing: MarketListingDto): ServerListing | null {
  if (listing.kind !== "item" || !listing.slot || !listing.rarity) return null;

  // Server rolls store all six stat keys with 0 for unset ones; the
  // Equipment.stats shape is sparse (only rolled keys present) — same
  // conversion as itemDtoToEquipment for inventory items.
  const rawStats = listing.stats ?? {};
  const stats: StatRoll = {};
  for (const key of STAT_KEYS) {
    const value = rawStats[key];
    if (value) stats[key] = value;
  }

  return {
    id: `listing-item-${listing.refId}`,
    kind: "item",
    refId: listing.refId,
    price: listing.price,
    seller: listing.owner,
    listedAt: listing.listedAt,
    item: {
      id: String(listing.refId),
      name: listing.name,
      slot: listing.slot as SlotKey,
      rarity: listing.rarity as Rarity,
      stats,
      level: listing.level ?? 1,
      equipped: false,
      createdAt: listing.listedAt,
    },
  };
}

/** Maps a unified MarketListingDto into the shape the cosmetic card renders. */
function toServerAssetListing(listing: MarketListingDto): ServerAssetListing | null {
  if (listing.kind !== "asset") return null;

  const cosmeticKind = cosmeticKindForTemplate(listing.templateId);
  const tpl =
    cosmeticKind === "avatar"
      ? getAvatarByTemplateId(listing.templateId)
      : cosmeticKind === "banner"
        ? getBannerByTemplateId(listing.templateId)
        : getBackgroundByTemplateId(listing.templateId);
  if (!tpl) return null;

  return {
    id: `listing-asset-${listing.refId}`,
    kind: "asset",
    refId: listing.refId,
    cosmeticKind,
    name: listing.name,
    image: tpl.image,
    price: listing.price,
    seller: listing.owner,
    listedAt: listing.listedAt,
  };
}

export function MarketplacePage() {
  const hydrated = useHydrated();
  const mode = useAuthStore((state) => state.mode);
  const walletConnected =
    useAuthStore((state) => state.mode === "wallet" && state.address !== null) && hydrated;
  const isDemo = hydrated && mode === "demo";
  const [connectOpen, setConnectOpen] = useState(false);

  const [listings, setListings] = useState<ServerListing[]>([]);
  const [assetListings, setAssetListings] = useState<ServerAssetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [chainBalance, setChainBalance] = useState<number | null>(null);
  const chainReady = isChainPaymentConfigured();

  const [category, setCategory] = useState<Category>("gear");
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [slot, setSlot] = useState<SlotKey | "all">("all");
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [cosmeticKind, setCosmeticKind] = useState<CosmeticKind | "all">("all");
  const [sort, setSort] = useState<SortKey>("listed");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [ownOnly, setOwnOnly] = useState(false);
  const [view, setView] = useState<"listings" | "history">("listings");

  const address = useAuthStore((state) => state.address);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getMarketListings();
    if (result.ok && result.listings) {
      setListings(
        result.listings.map(toServerListing).filter((l): l is ServerListing => l !== null),
      );
      setAssetListings(
        result.listings
          .map(toServerAssetListing)
          .filter((l): l is ServerAssetListing => l !== null),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshChainBalance = useCallback(async () => {
    if (!walletConnected || !address || !chainReady) {
      setChainBalance(null);
      return;
    }
    const balance = await getHashTokenBalance(address);
    setChainBalance(balance);
  }, [walletConnected, address, chainReady]);

  useEffect(() => {
    void refreshChainBalance();
  }, [refreshChainBalance]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshChainBalance()]);
    setRefreshing(false);
  };

  const toggleRarity = (rarity: Rarity) =>
    setRarities((prev) =>
      prev.includes(rarity) ? prev.filter((r) => r !== rarity) : [...prev, rarity],
    );

  const resetFilters = () => {
    setSearch("");
    setMaxPrice("");
    setSlot("all");
    setRarities([]);
    setCosmeticKind("all");
    setOwnOnly(false);
  };

  useEffect(() => {
    // Cosmetics have no slot/rarity-derived score or upgrade level, so fall
    // back to "listed" if a gear-only sort is active when switching tabs.
    if (category === "cosmetics" && (sort === "score" || sort === "level")) {
      setSort("listed");
      setSortDir("desc");
    }
  }, [category, sort]);

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setSortDir("asc");
    }
  };

  const handleBuy = async (listing: ServerListing | ServerAssetListing) => {
    const displayName = listing.kind === "item" ? listing.item.name : listing.name;

    if (!walletConnected) {
      setConnectOpen(true);
      return;
    }
    if (!chainReady) {
      notify("On-chain purchases aren't configured yet. Try again later.", "danger");
      return;
    }
    if ((chainBalance ?? 0) < listing.price) {
      notify("Not enough HASH tokens in your wallet to buy this item", "danger");
      return;
    }

    setBuyingId(listing.id);
    try {
      // Purchases are paid directly on-chain with the SPL game token — never
      // deducted from the in-game HASH balance.
      const { signature } = await payWithHashToken(getTreasuryAddress(), listing.price);
      const result = await buyMarketItem(listing.kind, listing.refId, signature);
      if (result.ok) {
        notify(
          `Payment sent — ${displayName} will be transferred to you once settlement confirms.`,
          "success",
        );
        if (listing.kind === "item") {
          setListings((prev) => prev.filter((l) => l.id !== listing.id));
        } else {
          setAssetListings((prev) => prev.filter((l) => l.id !== listing.id));
        }
        await refreshChainBalance();
      } else {
        notify(result.error ?? "Purchase failed", "danger");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Purchase failed", "danger");
    } finally {
      setBuyingId(null);
    }
  };

  const handleCancel = async (listing: ServerListing | ServerAssetListing) => {
    const displayName = listing.kind === "item" ? listing.item.name : listing.name;
    setCancellingId(listing.id);
    const result = await cancelMarketListing(listing.kind, listing.refId);
    if (result.ok) {
      notify(`Listing for ${displayName} cancelled.`, "success");
      if (listing.kind === "item") {
        setListings((prev) => prev.filter((l) => l.id !== listing.id));
      } else {
        setAssetListings((prev) => prev.filter((l) => l.id !== listing.id));
      }
    } else {
      notify(result.error ?? "Failed to cancel listing.", "danger");
    }
    setCancellingId(null);
  };

  const filtered = useMemo(() => {
    const cap = Number(maxPrice);
    const query = search.trim().toLowerCase();
    const priceCap = maxPrice.trim() && Number.isFinite(cap) ? cap : undefined;
    return listings
      .filter((listing) => {
        if (query && !listing.item.name.toLowerCase().includes(query)) return false;
        if (slot !== "all" && listing.item.slot !== slot) return false;
        if (rarities.length && !rarities.includes(listing.item.rarity)) return false;
        if (priceCap !== undefined && listing.price > priceCap) return false;
        if (ownOnly && (!address || listing.seller !== address)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sort === "price") return (a.price - b.price) * dir;
        if (sort === "level") return (a.item.level - b.item.level) * dir;
        if (sort === "score") return (equipmentScore(a.item) - equipmentScore(b.item)) * dir;
        return (a.listedAt - b.listedAt) * dir;
      });
  }, [listings, search, maxPrice, slot, rarities, sort, sortDir, ownOnly, address]);

  const filteredAssets = useMemo(() => {
    const cap = Number(maxPrice);
    const query = search.trim().toLowerCase();
    const priceCap = maxPrice.trim() && Number.isFinite(cap) ? cap : undefined;
    return assetListings
      .filter((listing) => {
        if (query && !listing.name.toLowerCase().includes(query)) return false;
        if (cosmeticKind !== "all" && listing.cosmeticKind !== cosmeticKind) return false;
        if (priceCap !== undefined && listing.price > priceCap) return false;
        if (ownOnly && (!address || listing.seller !== address)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sort === "price") return (a.price - b.price) * dir;
        return (a.listedAt - b.listedAt) * dir;
      });
  }, [assetListings, search, maxPrice, cosmeticKind, sort, sortDir, ownOnly, address]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Live listings from other miners. Buying and selling require a connected wallet."
      />

      {isDemo && !loading ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          You are in demo mode. These are real listings from the live market — connect a wallet to
          buy, and note that demo gear cannot be sold.
        </div>
      ) : null}

      {!isDemo && walletConnected && !chainReady ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          On-chain purchases aren&apos;t configured yet. Try again later.
        </div>
      ) : null}

      <div className="card-soft space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search listings"
            aria-label="Search listings"
          />
          <Input
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="Max price (HASH)"
            inputMode="numeric"
            aria-label="Max price"
            className="sm:max-w-48"
          />
          <Button
            variant="secondary"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="shrink-0 gap-2"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border/40 pb-3">
          {(
            [
              ["gear", "Gear"],
              ["cosmetics", "Cosmetics"],
            ] as [Category, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                category === key
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {category === "gear" ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...SLOT_KEYS] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSlot(key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    slot === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {key === "all" ? "All slots" : SLOT_META[key].label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Rarity
              </span>
              {RARITY_KEYS.map((rarity) => (
                <button
                  key={rarity}
                  type="button"
                  onClick={() => toggleRarity(rarity)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    rarities.includes(rarity)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {RARITY_META[rarity].label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Type
            </span>
            {(["all", "avatar", "banner", "background"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCosmeticKind(key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  cosmeticKind === key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {key === "all" ? "All types" : COSMETIC_KIND_LABEL[key]}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Sort
            </span>
            {(category === "gear"
              ? ([
                  ["listed", "Listed"],
                  ["price", "Price"],
                  ["score", "Score"],
                  ["level", "Level"],
                ] as [SortKey, string][])
              : ([
                  ["listed", "Listed"],
                  ["price", "Price"],
                ] as [SortKey, string][])
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSort(key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  sort === key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label} {sort === key && (sortDir === "asc" ? "↑" : "↓")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOwnOnly((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                ownOnly
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <User className="size-3.5" />
              {ownOnly ? "Your listings" : "All listings"}
            </button>
            <button
              type="button"
              onClick={() => setView((prev) => (prev === "history" ? "listings" : "history"))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                view === "history"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <History className="size-3.5" />
              History
            </button>
          </div>
        </div>
      </div>

      {!loading && view === "listings" && (listings.length > 0 || assetListings.length > 0) ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Gear listings", value: String(listings.length) },
            { label: "Cosmetic listings", value: String(assetListings.length) },
            {
              label: "Cheapest gear",
              value: listings.length
                ? `${formatHash(Math.min(...listings.map((l) => l.price)), 0)} HASH`
                : "—",
            },
            {
              label: "Cheapest cosmetic",
              value: assetListings.length
                ? `${formatHash(Math.min(...assetListings.map((l) => l.price)), 0)} HASH`
                : "—",
            },
          ].map((stat) => (
            <div key={stat.label} className="card-soft p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {view === "history" ? (
        <MarketSalesHistory />
      ) : loading ? (
        <p className="card-soft p-8 text-center text-sm text-muted-foreground">
          Loading live listings…
        </p>
      ) : category === "gear" ? (
        filtered.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((listing) => {
              const isOwn = Boolean(address) && listing.seller === address;
              // Purchases pay the on-chain SPL token directly, so affordability is
              // checked against the connected wallet's real token balance — not
              // the in-game HASH balance (which is spent on upgrades/chests only).
              const canAfford = !walletConnected || (chainBalance ?? 0) >= listing.price;
              return (
                <EquipmentCard
                  key={listing.id}
                  item={listing.item}
                  footer={
                    <ListingActions
                      listing={listing}
                      isOwn={isOwn}
                      canAfford={canAfford}
                      walletConnected={walletConnected}
                      chainBalance={chainBalance}
                      isBuying={buyingId === listing.id}
                      isCancelling={cancellingId === listing.id}
                      onBuy={() => void handleBuy(listing)}
                      onCancel={() => void handleCancel(listing)}
                    />
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="card-soft flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <span className="grid size-14 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground">
              <PackageSearch className="size-7" />
            </span>
            <p className="max-w-xs">No listings match your filters.</p>
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          </div>
        )
      ) : filteredAssets.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((listing) => {
            const isOwn = Boolean(address) && listing.seller === address;
            const canAfford = !walletConnected || (chainBalance ?? 0) >= listing.price;
            return (
              <AssetListingCard key={listing.id} listing={listing}>
                <ListingActions
                  listing={listing}
                  isOwn={isOwn}
                  canAfford={canAfford}
                  walletConnected={walletConnected}
                  chainBalance={chainBalance}
                  isBuying={buyingId === listing.id}
                  isCancelling={cancellingId === listing.id}
                  onBuy={() => void handleBuy(listing)}
                  onCancel={() => void handleCancel(listing)}
                />
              </AssetListingCard>
            );
          })}
        </div>
      ) : (
        <div className="card-soft flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
          <span className="grid size-14 place-items-center rounded-2xl bg-secondary/60 text-muted-foreground">
            <PackageSearch className="size-7" />
          </span>
          <p className="max-w-xs">No listings match your filters.</p>
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {!walletConnected ? (
        <ConnectWalletModal open={connectOpen} onOpenChange={setConnectOpen} />
      ) : null}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Shared price/buy/cancel block used by both the gear and cosmetics cards. */
function ListingActions({
  listing,
  isOwn,
  canAfford,
  walletConnected,
  chainBalance,
  isBuying,
  isCancelling,
  onBuy,
  onCancel,
}: {
  listing: ServerListing | ServerAssetListing;
  isOwn: boolean;
  canAfford: boolean;
  walletConnected: boolean;
  chainBalance: number | null;
  isBuying: boolean;
  isCancelling: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-auto space-y-2">
      <div className="flex items-end justify-between rounded-lg bg-secondary/60 px-2 py-1.5">
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {isOwn ? <User className="size-3" /> : <Store className="size-3" />}
          {isOwn ? "Your listing" : `@${listing.seller.slice(0, 6)}…`}
        </span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            !walletConnected || canAfford || isOwn ? "text-primary" : "text-destructive",
          )}
        >
          {formatHash(listing.price, 0)} HASH
        </span>
      </div>
      {isOwn ? (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">
            You receive ~{formatHash(listing.price * (1 - MARKET_FEE))} HASH after{" "}
            {Math.round(MARKET_FEE * 100)}% fee when this sells
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isCancelling}
            onClick={onCancel}
          >
            {isCancelling ? "Cancelling…" : "Cancel listing"}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          className="w-full"
          disabled={(walletConnected && !canAfford) || isBuying}
          onClick={onBuy}
        >
          {isBuying ? (
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="size-3.5 animate-spin" /> Confirming…
            </span>
          ) : !walletConnected ? (
            "Connect to buy"
          ) : canAfford ? (
            "Buy"
          ) : (
            `Need ${formatHash(listing.price - (chainBalance ?? 0))} HASH`
          )}
        </Button>
      )}
    </div>
  );
}

/** Cosmetic listing card — avatars render as a circular preview, banners and
 * backgrounds render as a wide 3:1 preview, matching EditCosmeticsModal. */
function AssetListingCard({
  listing,
  children,
}: {
  listing: ServerAssetListing;
  children: React.ReactNode;
}) {
  const isAvatar = listing.cosmeticKind === "avatar";
  const KindIcon = isAvatar
    ? User
    : listing.cosmeticKind === "banner"
      ? RectangleHorizontal
      : ImageIcon;

  return (
    <article className="card-soft flex flex-col gap-3 p-4 ring-1 ring-inset ring-border/50">
      <div
        className={cn(
          "w-full overflow-hidden bg-secondary",
          isAvatar ? "mx-auto aspect-square w-24 rounded-full" : "aspect-[3/1] rounded-xl",
        )}
      >
        <img src={listing.image} alt={listing.name} className="size-full object-cover" />
      </div>
      <div className={cn(isAvatar && "text-center")}>
        <h3 className="truncate text-sm font-semibold">{listing.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <KindIcon className={cn("size-3", isAvatar && "mx-auto")} />
          <span className={cn(isAvatar && "sr-only")}>
            {COSMETIC_KIND_LABEL[listing.cosmeticKind]}
          </span>
        </p>
      </div>
      {children}
    </article>
  );
}
