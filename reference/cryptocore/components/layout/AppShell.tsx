"use client";

import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";

import { ConnectGate } from "@/components/auth/ConnectGate";
import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/useHydrated";
import { useMiningTick } from "@/hooks/useMiningTick";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/stores/authStore";
import { useEquipmentStore } from "@/features/stores/equipmentStore";
import { usePlayerStore } from "@/features/stores/playerStore";
import {
  getBackgroundByTemplateId,
  DEFAULT_BACKGROUND_TEMPLATE_ID,
} from "@/features/templates/backgrounds";

function GameLoop() {
  useMiningTick();
  const mode = useAuthStore((state) => state.mode);
  const syncFromApi = usePlayerStore((state) => state.syncFromApi);
  const syncEquipmentFromApi = useEquipmentStore((state) => state.syncFromApi);

  // On game loop mount, pull authoritative server state so the player always
  // sees their real DB values (not stale persisted localStorage data). This
  // also covers gear: the equipment store is a local cache too, and without
  // this it never self-corrects against `/api/items` (e.g. drift from a past
  // bug, or a listing/equip made from another device/tab).
  useEffect(() => {
    if (mode === "wallet") {
      void syncFromApi();
      void syncEquipmentFromApi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real wallet sessions: every 10s, re-pull from GET /api/player/me and
  // GET /api/items. The player route ticks and persists the vault
  // server-side on every call, so this both keeps the on-screen vault honest
  // against the DB (the client's own per-second ticking in useMiningTick is
  // a local, optimistic estimate) and periodically flushes mined HASH to the
  // DB even if the player never triggers a mutation (claim/upgrade/burn)
  // that would otherwise sync it. Re-pulling items keeps gear in sync the
  // same way. Demo sessions have no DB-backed player, so they're excluded.
  useEffect(() => {
    if (mode !== "wallet") return;
    const id = window.setInterval(() => {
      void syncFromApi();
      void syncEquipmentFromApi();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [mode, syncFromApi, syncEquipmentFromApi]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const connected = useAuthStore((state) => state.address !== null && state.username !== null);
  // True when wallet/demo is connected but no username has been chosen yet.
  // We need to intercept this globally — even on public routes — so the step-2
  // modal fires immediately after wallet connect, not only when navigating to a
  // protected route.
  const needsUsername = useAuthStore((state) => state.address !== null && state.username === null);
  const isPublicRoute = pathname === "/" || pathname === "/marketplace" || pathname === "/wiki";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Resolve background: use player's selected background when connected,
  // fall back to the default (001) for guests. Applied on all routes.
  const selectedBackgroundId = usePlayerStore((state) => state.background);
  const backgroundId = connected
    ? (selectedBackgroundId ?? DEFAULT_BACKGROUND_TEMPLATE_ID)
    : DEFAULT_BACKGROUND_TEMPLATE_ID;
  const bgImage = getBackgroundByTemplateId(backgroundId)?.image;

  return (
    <div className="h-screen overflow-hidden text-foreground">
      <div className="flex h-full">
        <aside
          className={cn(
            "relative hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
            collapsed ? "w-[56px]" : "w-[240px]",
          )}
        >
          <SidebarNav
            collapsed={collapsed}
            showBalances={hydrated && connected}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[80vw] max-w-[280px] border-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav
              showBalances={hydrated && connected}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Menu className="size-4" />
            </button>
            <Link href="/" className="ml-auto flex items-center focus:outline-none">
              <BrandLogo className="h-6" />
            </Link>
          </header>

          <main
            className="relative flex-1 overflow-y-auto overflow-x-hidden"
            style={
              bgImage
                ? {
                    backgroundImage: `linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0.75)), url(${bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                    backgroundAttachment: "local",
                  }
                : undefined
            }
          >
            <div className="relative z-10">
              {hydrated ? (
                isPublicRoute ? (
                  <div className="mx-auto min-h-full w-full min-w-0 max-w-6xl px-4 py-6 md:px-8 md:py-8">
                    {children}
                  </div>
                ) : connected ? (
                  <>
                    <GameLoop />
                    <div className="mx-auto min-h-full w-full min-w-0 max-w-6xl px-4 py-6 md:px-8 md:py-8">
                      {children}
                    </div>
                  </>
                ) : (
                  <ConnectGate />
                )
              ) : (
                <div className="grid min-h-[60vh] place-items-center px-4 py-20">
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute h-14 w-14 rounded-full border border-primary/20" />
                      <div className="absolute h-14 w-14 rounded-full border-t-2 border-primary animate-spin" />
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    </div>
                    <p className="mt-5 text-sm font-medium text-muted-foreground animate-pulse">
                      Loading your rig…
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Global step-2 gate: fires on ANY route the moment a wallet is connected
          but no username has been claimed yet. Prevents skipping the username
          step by staying on the homepage or marketplace after connecting. */}
      {hydrated && needsUsername && <ConnectWalletModal open onOpenChange={() => {}} />}
    </div>
  );
}
