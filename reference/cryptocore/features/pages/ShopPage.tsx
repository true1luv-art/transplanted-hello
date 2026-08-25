"use client";

import { useState } from "react";
import { Check, Loader2, ShoppingCart, Wallet } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { avatarTemplates } from "@/features/templates/avatars";
import { bannerTemplates } from "@/features/templates/banners";
import { backgroundTemplates } from "@/features/templates/backgrounds";
import { buyCosmetic, loadAuthToken } from "@/lib/api/client";
import { formatHash } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGameStats } from "@/hooks/useGameStats";
import { usePlayerStore } from "@/features/stores/playerStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateRecord {
  _id: number;
  mintCount: number;
  maxSupply: number | null;
}

interface OwnedAsset {
  templateId: number;
  kind: "avatar" | "banner" | "background";
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchTemplates(): Promise<TemplateRecord[]> {
  const res = await fetch("/api/templates");
  if (!res.ok) return [];
  const json = (await res.json()) as { ok: boolean; templates?: TemplateRecord[] };
  return json.templates ?? [];
}

async function fetchOwnedAssets(): Promise<OwnedAsset[]> {
  const token = loadAuthToken();
  if (!token) return [];
  const res = await fetch("/api/assets", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { ok: boolean; assets?: OwnedAsset[] };
  return json.assets ?? [];
}

// ─── ShopPage ─────────────────────────────────────────────────────────────────

export function ShopPage() {
  const { wallet } = useGameStats();
  const syncFromApi = usePlayerStore((state) => state.syncFromApi);

  const { data: templates = [], mutate: mutateTemplates } = useSWR<TemplateRecord[]>(
    "shop-templates",
    fetchTemplates,
    { revalidateOnFocus: false },
  );

  const { data: ownedAssets = [], mutate: mutateOwned } = useSWR<OwnedAsset[]>(
    "owned-assets",
    fetchOwnedAssets,
    { revalidateOnFocus: false },
  );

  const [buying, setBuying] = useState<number | null>(null);
  const [justBought, setJustBought] = useState<Set<number>>(new Set());

  const templateMap = new Map(templates.map((t) => [t._id, t]));
  const ownedSet = new Set(ownedAssets.map((a) => a.templateId));

  async function handleBuy(templateId: number, price: number) {
    if (buying !== null) return;
    setBuying(templateId);
    try {
      const result = await buyCosmetic(templateId);
      if (result.ok) {
        setJustBought((prev) => new Set(prev).add(templateId));
        await Promise.all([mutateTemplates(), mutateOwned(), syncFromApi()]);
      } else {
        // Surface the error via a toast-compatible mechanism (notify if available)
        try {
          const { notify } = await import("@/lib/notify");
          notify(result.error ?? "Purchase failed", "danger");
        } catch {
          // notify not available in this context
        }
      }
    } finally {
      setBuying(null);
    }
  }

  const purchasableAvatars = avatarTemplates.filter((t) => !t.soulbound);
  const purchasableBanners = bannerTemplates.filter((t) => !t.soulbound);
  const purchasableBackgrounds = backgroundTemplates.filter((t) => !t.soulbound);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cosmetics Shop"
        description="Unlock unique avatars, banners, and backgrounds with HASH. Each cosmetic has a limited supply."
      >
        <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2">
          <Wallet className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatHash(wallet, 0)}
          </span>
          <span className="text-xs text-muted-foreground">HASH</span>
        </div>
      </PageHeader>

      <Tabs defaultValue="avatars">
        <TabsList className="justify-start gap-1 rounded-lg bg-secondary/50 p-1">
          <TabsTrigger value="avatars" className="text-xs font-medium">
            Avatars ({purchasableAvatars.length})
          </TabsTrigger>
          <TabsTrigger value="banners" className="text-xs font-medium">
            Banners ({purchasableBanners.length})
          </TabsTrigger>
          <TabsTrigger value="backgrounds" className="text-xs font-medium">
            Backgrounds ({purchasableBackgrounds.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Avatars ── */}
        <TabsContent value="avatars" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {purchasableAvatars.map((tpl) => {
              const live = templateMap.get(tpl.templateId);
              const mintCount = live?.mintCount ?? 0;
              const maxSupply = live?.maxSupply ?? tpl.maxSupply ?? 1000;
              const soldOut = maxSupply !== null && mintCount >= maxSupply;
              const owned = ownedSet.has(tpl.templateId) || justBought.has(tpl.templateId);
              return (
                <AvatarCard
                  key={tpl.templateId}
                  templateId={tpl.templateId}
                  name={tpl.name}
                  image={tpl.image}
                  price={tpl.price}
                  mintCount={mintCount}
                  maxSupply={maxSupply}
                  soldOut={soldOut}
                  owned={owned}
                  isBuying={buying === tpl.templateId}
                  onBuy={() => handleBuy(tpl.templateId, tpl.price)}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* ── Banners ── */}
        <TabsContent value="banners" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {purchasableBanners.map((tpl) => {
              const live = templateMap.get(tpl.templateId);
              const mintCount = live?.mintCount ?? 0;
              const maxSupply = live?.maxSupply ?? tpl.maxSupply ?? 1000;
              const soldOut = maxSupply !== null && mintCount >= maxSupply;
              const owned = ownedSet.has(tpl.templateId) || justBought.has(tpl.templateId);
              return (
                <WideCard
                  key={tpl.templateId}
                  templateId={tpl.templateId}
                  name={tpl.name}
                  image={tpl.image}
                  price={tpl.price}
                  mintCount={mintCount}
                  maxSupply={maxSupply}
                  soldOut={soldOut}
                  owned={owned}
                  aspect="3/1"
                  isBuying={buying === tpl.templateId}
                  onBuy={() => handleBuy(tpl.templateId, tpl.price)}
                />
              );
            })}
          </div>
        </TabsContent>

        {/* ── Backgrounds ── */}
        <TabsContent value="backgrounds" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {purchasableBackgrounds.map((tpl) => {
              const live = templateMap.get(tpl.templateId);
              const mintCount = live?.mintCount ?? 0;
              const maxSupply = live?.maxSupply ?? tpl.maxSupply ?? 1000;
              const soldOut = maxSupply !== null && mintCount >= maxSupply;
              const owned = ownedSet.has(tpl.templateId) || justBought.has(tpl.templateId);
              return (
                <WideCard
                  key={tpl.templateId}
                  templateId={tpl.templateId}
                  name={tpl.name}
                  image={tpl.image}
                  price={tpl.price}
                  mintCount={mintCount}
                  maxSupply={maxSupply}
                  soldOut={soldOut}
                  owned={owned}
                  aspect="16/9"
                  isBuying={buying === tpl.templateId}
                  onBuy={() => handleBuy(tpl.templateId, tpl.price)}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Card sub-components ──────────────────────────────────────────────────────

interface CardProps {
  templateId: number;
  name: string;
  image: string;
  price: number;
  mintCount: number;
  maxSupply: number | null;
  soldOut: boolean;
  owned: boolean;
  isBuying: boolean;
  onBuy: () => void;
}

function SupplyBar({ mintCount, maxSupply }: { mintCount: number; maxSupply: number | null }) {
  if (!maxSupply) return null;
  const pct = Math.min(100, (mintCount / maxSupply) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{mintCount.toLocaleString()} minted</span>
        <span>of {maxSupply.toLocaleString()}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 90 ? "bg-destructive" : pct >= 60 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BuyButton({
  price,
  soldOut,
  owned,
  isBuying,
  onBuy,
}: Pick<CardProps, "price" | "soldOut" | "owned" | "isBuying" | "onBuy">) {
  if (owned) {
    return (
      <div className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-success/15 text-xs font-semibold text-success">
        <Check className="size-3.5" />
        Owned
      </div>
    );
  }

  if (soldOut) {
    return (
      <div className="flex h-8 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
        Sold Out
      </div>
    );
  }

  return (
    <Button
      size="sm"
      className="h-8 w-full gap-1.5 text-xs font-semibold"
      disabled={isBuying}
      onClick={onBuy}
    >
      {isBuying ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <ShoppingCart className="size-3.5" />
      )}
      {isBuying ? "Buying…" : `${formatHash(price, 0)} HASH`}
    </Button>
  );
}

function AvatarCard({
  name,
  image,
  price,
  mintCount,
  maxSupply,
  soldOut,
  owned,
  isBuying,
  onBuy,
}: CardProps) {
  return (
    <div
      className={cn(
        "card-soft flex flex-col overflow-hidden transition-all duration-200",
        owned && "ring-1 ring-success/40",
        soldOut && "opacity-60",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        <img src={image} alt={name} className="size-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="text-sm font-semibold leading-tight">{name}</p>
        <SupplyBar mintCount={mintCount} maxSupply={maxSupply} />
        <BuyButton
          price={price}
          soldOut={soldOut}
          owned={owned}
          isBuying={isBuying}
          onBuy={onBuy}
        />
      </div>
    </div>
  );
}

function WideCard({
  name,
  image,
  price,
  mintCount,
  maxSupply,
  soldOut,
  owned,
  aspect,
  isBuying,
  onBuy,
}: CardProps & { aspect: "3/1" | "16/9" }) {
  return (
    <div
      className={cn(
        "card-soft flex flex-col overflow-hidden transition-all duration-200",
        owned && "ring-1 ring-success/40",
        soldOut && "opacity-60",
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-secondary",
          aspect === "3/1" ? "aspect-[3/1]" : "aspect-video",
        )}
      >
        <img src={image} alt={name} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-3 right-3">
          <p className="truncate text-sm font-semibold text-white drop-shadow">{name}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <SupplyBar mintCount={mintCount} maxSupply={maxSupply} />
        <BuyButton
          price={price}
          soldOut={soldOut}
          owned={owned}
          isBuying={isBuying}
          onBuy={onBuy}
        />
      </div>
    </div>
  );
}
