"use client";

import { useEffect, useState } from "react";
import { Check, Lock, Loader2, Tag } from "lucide-react";
import useSWR from "swr";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getAvatarByTemplateId } from "@/features/templates/avatars";
import { getBannerByTemplateId } from "@/features/templates/banners";
import { getBackgroundByTemplateId } from "@/features/templates/backgrounds";
import { MARKET_FEE } from "@/features/stores/marketplaceStore";
import { isDemoSession } from "@/features/stores/authStore";
import { loadAuthToken, listMarketItem } from "@/lib/api/client";
import { formatHash } from "@/lib/format";
import { notify } from "@/lib/notify";
import { usePlayerStore } from "@/features/stores/playerStore";
import { cn } from "@/lib/utils";

interface EditCosmeticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OwnedAsset {
  assetNumber: number;
  templateId: number;
  kind: "avatar" | "banner" | "background";
  soulbound: boolean;
  mintNumber: number;
  equipped: boolean;
}

async function fetchAssets(): Promise<OwnedAsset[]> {
  const token = loadAuthToken();
  if (!token) return [];
  const res = await fetch("/api/assets", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const json = (await res.json()) as { ok: boolean; assets?: OwnedAsset[] };
  return json.assets ?? [];
}

async function equipAsset(assetNumber: number): Promise<boolean> {
  const token = loadAuthToken();
  if (!token) return false;
  const res = await fetch("/api/assets/equip", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assetNumber }),
  });
  return res.ok;
}

/** Resolves display metadata (name, image, mint price) for an owned asset. */
function templateFor(asset: OwnedAsset) {
  if (asset.kind === "avatar") return getAvatarByTemplateId(asset.templateId);
  if (asset.kind === "banner") return getBannerByTemplateId(asset.templateId);
  return getBackgroundByTemplateId(asset.templateId);
}

export function EditCosmeticsModal({ open, onOpenChange }: EditCosmeticsModalProps) {
  const {
    data: assets = [],
    isLoading,
    mutate,
  } = useSWR<OwnedAsset[]>(open ? "owned-assets" : null, fetchAssets, { revalidateOnFocus: false });

  const syncFromApi = usePlayerStore((state) => state.syncFromApi);
  const [saving, setSaving] = useState(false);

  /** Demo accounts play locally, so there is no real market to sell into. */
  const canSell = !isDemoSession();

  const [tab, setTab] = useState<"avatar" | "banner" | "background">("avatar");
  const [sellTarget, setSellTarget] = useState<OwnedAsset | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [selling, setSelling] = useState(false);

  // Pending selections: assetNumber per kind
  const equippedAvatar = assets.find((a) => a.kind === "avatar" && a.equipped);
  const equippedBanner = assets.find((a) => a.kind === "banner" && a.equipped);
  const equippedBackground = assets.find((a) => a.kind === "background" && a.equipped);

  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<number | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<number | null>(null);

  // Sync selections to equipped when assets load
  useEffect(() => {
    setSelectedAvatar(equippedAvatar?.assetNumber ?? null);
    setSelectedBanner(equippedBanner?.assetNumber ?? null);
    setSelectedBackground(equippedBackground?.assetNumber ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length]);

  async function handleSave() {
    setSaving(true);
    const ops: Promise<boolean>[] = [];
    if (selectedAvatar !== null && selectedAvatar !== equippedAvatar?.assetNumber)
      ops.push(equipAsset(selectedAvatar));
    if (selectedBanner !== null && selectedBanner !== equippedBanner?.assetNumber)
      ops.push(equipAsset(selectedBanner));
    if (selectedBackground !== null && selectedBackground !== equippedBackground?.assetNumber)
      ops.push(equipAsset(selectedBackground));
    await Promise.all(ops);
    await mutate();
    // Refresh the player store so the resolved cosmetics (banner/avatar/background)
    // reflect the new selection everywhere immediately.
    await syncFromApi();
    setSaving(false);
    onOpenChange(false);
  }

  const avatarAssets = assets.filter((a) => a.kind === "avatar");
  const bannerAssets = assets.filter((a) => a.kind === "banner");
  const backgroundAssets = assets.filter((a) => a.kind === "background");

  // The asset currently highlighted in the active tab is the one "Sell" acts on.
  const selectedAssetNumber =
    tab === "avatar" ? selectedAvatar : tab === "banner" ? selectedBanner : selectedBackground;
  const selectedAsset = assets.find((a) => a.assetNumber === selectedAssetNumber) ?? null;
  const canSellSelected =
    Boolean(selectedAsset) && !selectedAsset!.soulbound && !selectedAsset!.equipped;

  const sellTpl = sellTarget ? templateFor(sellTarget) : null;
  const listPrice = Number(sellPrice);
  const priceValid = Number.isFinite(listPrice) && listPrice > 0;
  const net = priceValid ? listPrice * (1 - MARKET_FEE) : 0;

  function openSellDialog() {
    if (!selectedAsset || !canSellSelected) return;
    const tpl = templateFor(selectedAsset);
    setSellPrice(String(tpl?.price && tpl.price > 0 ? tpl.price : 100));
    setSellTarget(selectedAsset);
  }

  async function handleSell() {
    if (!sellTarget || !priceValid) return;
    setSelling(true);
    const result = await listMarketItem("asset", sellTarget.assetNumber, listPrice);
    setSelling(false);
    if (!result.ok) {
      notify(result.error ?? "Could not list this cosmetic for sale", "danger");
      return;
    }

    const tpl = templateFor(sellTarget);
    notify(
      `${tpl?.name ?? "Cosmetic"} listed for ${formatHash(listPrice)} HASH on the marketplace`,
      "success",
    );

    // Clear any selection pointing at the now-listed asset, then refresh.
    if (sellTarget.kind === "avatar" && selectedAvatar === sellTarget.assetNumber)
      setSelectedAvatar(equippedAvatar?.assetNumber ?? null);
    if (sellTarget.kind === "banner" && selectedBanner === sellTarget.assetNumber)
      setSelectedBanner(equippedBanner?.assetNumber ?? null);
    if (sellTarget.kind === "background" && selectedBackground === sellTarget.assetNumber)
      setSelectedBackground(equippedBackground?.assetNumber ?? null);

    setSellTarget(null);
    await mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-base font-semibold">Edit profile cosmetics</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as typeof tab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-6 mt-4 shrink-0 justify-start gap-1 rounded-lg bg-secondary/50 p-1">
            <TabsTrigger value="avatar" className="text-xs font-medium">
              Avatar ({avatarAssets.length})
            </TabsTrigger>
            <TabsTrigger value="banner" className="text-xs font-medium">
              Banner ({bannerAssets.length})
            </TabsTrigger>
            <TabsTrigger value="background" className="text-xs font-medium">
              Background ({backgroundAssets.length})
            </TabsTrigger>
          </TabsList>

          {/* Avatar grid */}
          <TabsContent value="avatar" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <LoadingGrid />
            ) : (
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {avatarAssets.map((asset) => {
                  const tpl = getAvatarByTemplateId(asset.templateId);
                  if (!tpl) return null;
                  const selected = selectedAvatar === asset.assetNumber;
                  return (
                    <button
                      key={asset.assetNumber}
                      type="button"
                      onClick={() => setSelectedAvatar(asset.assetNumber)}
                      className={cn(
                        "group relative flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "ring-2 ring-primary bg-primary/10"
                          : "ring-1 ring-border/50 hover:ring-border",
                      )}
                      title={tpl.name}
                    >
                      <div className="relative size-14 overflow-hidden rounded-full bg-secondary">
                        <img src={tpl.image} alt={tpl.name} className="size-full object-cover" />
                        {selected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                            <Check className="size-5 text-white drop-shadow" />
                          </div>
                        )}
                      </div>
                      <span className="line-clamp-1 w-full text-center text-[9px] text-muted-foreground leading-tight">
                        {tpl.name}
                      </span>
                      <MintBadge asset={asset} />
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Banner grid */}
          <TabsContent value="banner" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <LoadingGrid cols={3} aspect="3/1" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {bannerAssets.map((asset) => {
                  const tpl = getBannerByTemplateId(asset.templateId);
                  if (!tpl) return null;
                  const selected = selectedBanner === asset.assetNumber;
                  return (
                    <button
                      key={asset.assetNumber}
                      type="button"
                      onClick={() => setSelectedBanner(asset.assetNumber)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "ring-2 ring-primary"
                          : "ring-1 ring-border/50 hover:ring-border",
                      )}
                      title={tpl.name}
                    >
                      <div className="aspect-[3/1] w-full bg-secondary">
                        <img src={tpl.image} alt={tpl.name} className="size-full object-cover" />
                      </div>
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
                          <Check className="size-6 text-white drop-shadow" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
                        <p className="text-[10px] font-medium text-white/90 truncate">{tpl.name}</p>
                      </div>
                      <MintBadge asset={asset} className="absolute top-1.5 right-1.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Background grid */}
          <TabsContent value="background" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <LoadingGrid cols={3} aspect="3/1" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {backgroundAssets.map((asset) => {
                  const tpl = getBackgroundByTemplateId(asset.templateId);
                  if (!tpl) return null;
                  const selected = selectedBackground === asset.assetNumber;
                  return (
                    <button
                      key={asset.assetNumber}
                      type="button"
                      onClick={() => setSelectedBackground(asset.assetNumber)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "ring-2 ring-primary"
                          : "ring-1 ring-border/50 hover:ring-border",
                      )}
                      title={tpl.name}
                    >
                      <div className="aspect-[3/1] w-full bg-secondary">
                        <img src={tpl.image} alt={tpl.name} className="size-full object-cover" />
                      </div>
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
                          <Check className="size-6 text-white drop-shadow" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
                        <p className="text-[10px] font-medium text-white/90 truncate">{tpl.name}</p>
                      </div>
                      <MintBadge asset={asset} className="absolute top-1.5 right-1.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="shrink-0 border-t border-border/60 px-6 py-4">
          <div className="flex gap-2">
            {canSell && (
              <Button
                type="button"
                variant="outline"
                onClick={openSellDialog}
                disabled={!canSellSelected}
                title={
                  !selectedAsset
                    ? "Select a cosmetic to sell"
                    : selectedAsset.soulbound
                      ? "Default cosmetics can't be sold"
                      : selectedAsset.equipped
                        ? "Unequip this cosmetic before selling it"
                        : undefined
                }
              >
                <Tag className="mr-2 size-4" />
                Sell
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Sell confirmation */}
      <AlertDialog
        open={Boolean(sellTarget)}
        onOpenChange={(isOpen) => (isOpen ? null : setSellTarget(null))}
      >
        <AlertDialogContent>
          {sellTarget && sellTpl ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>List For Sale</AlertDialogTitle>
                <AlertDialogDescription className="sr-only">
                  List {sellTpl.name} on the marketplace
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div
                  className={cn(
                    "shrink-0 overflow-hidden bg-secondary",
                    sellTarget.kind === "avatar"
                      ? "size-14 rounded-full"
                      : "aspect-[3/1] w-24 rounded-lg",
                  )}
                >
                  <img src={sellTpl.image} alt={sellTpl.name} className="size-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{sellTpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sellTarget.kind.charAt(0).toUpperCase() + sellTarget.kind.slice(1)} · #
                    {sellTarget.mintNumber}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm">
                  List this cosmetic on the in-game marketplace. When it sells, you receive the
                  price minus a {Math.round(MARKET_FEE * 100)}% marketplace fee.
                </p>
                <div>
                  <p className="mb-1.5 text-sm font-medium">Price:</p>
                  <div className="flex overflow-hidden rounded-md border border-input">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellPrice}
                      onChange={(event) => setSellPrice(event.target.value)}
                      className="rounded-none border-0 focus-visible:ring-0"
                    />
                    <span className="grid shrink-0 place-items-center border-l border-input bg-secondary px-3 text-xs font-semibold">
                      HASH
                    </span>
                  </div>
                  <p className="mt-1.5 text-right text-xs text-muted-foreground">
                    When sold you receive ~
                    <span className="font-semibold text-success">{formatHash(net)} HASH</span> after
                    fees
                  </p>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={selling}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSell} disabled={!priceValid || selling}>
                  {selling ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Listing…
                    </>
                  ) : (
                    "List for sale"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MintBadge({ asset, className }: { asset: OwnedAsset; className?: string }) {
  if (asset.soulbound) {
    return (
      <span
        className={cn(
          "flex items-center gap-0.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground",
          className,
        )}
      >
        <Lock className="size-2.5" /> Default
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full bg-background/80 px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground",
        className,
      )}
    >
      #{asset.mintNumber}
    </span>
  );
}

function LoadingGrid({ cols = 6, aspect }: { cols?: number; aspect?: string }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 6 ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3",
      )}
    >
      {Array.from({ length: cols * 2 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-xl bg-secondary/50",
            aspect ? `aspect-[${aspect}]` : "aspect-square",
          )}
        />
      ))}
    </div>
  );
}
