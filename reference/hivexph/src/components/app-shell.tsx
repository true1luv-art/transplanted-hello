import { useState, useEffect, type ReactNode } from "react";
import {
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  Menu,
  PanelLeft,
  User,
  LogOut,
  Contrast,
  Repeat2,
  CandlestickChart,
  Shuffle,
  Waves,
  Coins,
  Users,
  Heart,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchTokens } from "@/lib/fetchers/tokens";
import { hiveAvatarUrl } from "@/lib/fetchers/hive-account-helpers";


import { WalletCard } from "@/components/wallet-card";
import { cn } from "@/lib/utils";
import { NotificationsBellWrapper } from "@/components/notifications-bell-wrapper";
import { BrandLogo } from "@/components/brand-logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { STORAGE_KEYS } from "@/lib/config/config";
import { type AppUser } from "@/lib/session-shared";
import { fetchPostingJsonMeta } from "@/lib/fetchers/hive-account-helpers";
import { LoginModal } from "@/components/login-modal";
import { SwitchAccountModal } from "@/components/switch-account-modal";
import { DonateModal } from "@/components/donate-modal";

// ── Theme helpers ─────────────────────────────────────────────────────────────

function getTheme(): "light" | "dark" | "system" {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function applyTheme(theme: "light" | "dark" | "system") {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

// ── Nav definitions ───────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
};

const workspaceItems: NavItem[] = [
  { label: "P2P", to: "/p2p", icon: Repeat2, exact: true },
  { label: "Swap", to: "/swap", icon: Shuffle },
  { label: "Trade", to: "/trade", icon: CandlestickChart },
  { label: "Tokens", to: "/tokens", icon: Coins, exact: true },
  { label: "Pools", to: "/pools", icon: Waves },
  { label: "HiveX Tools", to: "/tools", icon: Wrench },
];

// ── Shared helpers ────────────────────────────────────────────────────────────

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const isActive = useIsActive()(item.to, item.exact);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors",
        collapsed && "justify-center px-0 py-2.5",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-[15px] flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

// ── AccountDropdown ───────────────────────────────────────────────────────────

function AccountDropdown({ user, collapsed }: { user: AppUser; collapsed: boolean }) {
  const navigate = useNavigate();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(() =>
    typeof window !== "undefined" ? getTheme() : "system",
  );

  const setTheme = (t: "light" | "dark" | "system") => {
    applyTheme(t);
    setThemeState(t);
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-accent focus:outline-none",
          collapsed && "justify-center",
        )}
      >
        <div className="relative flex size-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-mono text-[11px] font-bold uppercase text-primary-foreground">
          <span aria-hidden>{user.avatarInitials || user.username.slice(0, 2).toUpperCase()}</span>
          <img
            src={hiveAvatarUrl(user.username)}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {user.fullName || user.username}
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              @{user.username}
            </p>
          </div>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="bottom" className="w-56">
        <div className="px-1.5 py-2">
          <p className="text-sm font-semibold text-foreground">{user.fullName || user.username}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">@{user.username}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() =>
              navigate({ to: "/profile/$username", params: { username: user.username } })
            }
          >
            <User className="size-3.5" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSwitchOpen(true)}>
            <Users className="size-3.5" />
            Switch Account
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Contrast className="size-3.5" />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(val) => setTheme(val as "light" | "dark" | "system")}
              >
                {(["light", "dark", "system"] as const).map((opt) => (
                  <DropdownMenuRadioItem key={opt} value={opt}>
                    <span className="capitalize">{opt}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={async () => {
              const { logoutFn } = await import("@/lib/auth.functions");
              await logoutFn();
              navigate({ to: "/" });
              window.location.reload();
            }}
          >
            <LogOut className="size-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <SwitchAccountModal
      open={switchOpen}
      onOpenChange={setSwitchOpen}
      currentUsername={user.username}
    />
    </>
  );
}

// ── SidebarBody ───────────────────────────────────────────────────────────────

function SidebarBody({
  user,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  user: AppUser;
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-visible">
      <div className="group/header relative flex items-center gap-2 px-3 py-3">
        <Link
          to="/"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm focus:outline-none",
            collapsed && "justify-center",
          )}
        >
          <BrandLogo
            className={cn(
              "size-6 flex-shrink-0 object-contain",
              collapsed && "group-hover/header:opacity-70",
            )}
          />
          {!collapsed && (
            <span className="truncate text-[14px] font-semibold text-foreground">HiveX PH</span>
          )}
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
            className={cn(
              "hidden items-center justify-center rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground md:inline-flex",
              collapsed &&
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/header:opacity-100",
            )}
          >
            <PanelLeft className="size-4" />
          </button>
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-1 px-2 pb-2 pt-0",
          collapsed && "justify-center",
        )}
      >
        {user.isLoggedIn ? (
          <>
            <div className="min-w-0 flex-1">
              <AccountDropdown user={user} collapsed={collapsed} />
            </div>
            {!collapsed && <NotificationsBellWrapper username={user.username} />}
          </>
        ) : (
          !collapsed && (
            <LoginModal>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                <User className="size-3.5 shrink-0" />
                Sign in with Keychain
              </button>
            </LoginModal>
          )
        )}
      </div>

      <div className="mx-3 mb-3 border-t border-border/50" />

      {user.isLoggedIn && (
        <WalletCard username={user.username} collapsed={collapsed} />
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 pb-4">
        {workspaceItems.map((item) => (
          <NavLink key={item.to} item={item} collapsed={collapsed} onClick={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto px-3 py-3">
        <a
          href="https://peakd.com/@rhiaji"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="relative flex size-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-mono text-[8px] font-bold uppercase text-primary-foreground">
            <span aria-hidden>RJ</span>
            <img
              src={hiveAvatarUrl("rhiaji")}
              alt=""
              className="absolute inset-0 size-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          {!collapsed && <span>Created by @rhiaji</span>}
        </a>
        <DonateModal recipient="hivexph" user={user}>
          <button
            type="button"
            aria-label="Support us with a donation"
            className={cn(
              "mt-2 flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20",
              collapsed && "justify-center px-0",
            )}
          >
            <Heart className="size-3.5 shrink-0 fill-current" />
            {!collapsed && <span>Support us</span>}
          </button>
        </DonateModal>
      </div>
    </div>
  );
}

// ── MarketTicker ──────────────────────────────────────────────────────────────

function MarketTicker() {
  const { data } = useQuery({
    queryKey: ["market-ticker-trending-top10"],
    queryFn: async () => {
      const tokens = await fetchTokens();
      const withVol = tokens.filter((t) => parseFloat(t.volume || "0") > 0);
      const top = [...withVol]
        .sort((a, b) => parseFloat(b.volume || "0") - parseFloat(a.volume || "0"))
        .slice(0, 10)
        .map((t) => {
          const priceHive = parseFloat(t.lastPrice || "0");
          const usd = parseFloat(t.lastPriceUsd || "0");
          const chgNum = parseFloat(t.priceChangePercent || "0");
          return {
            sym: t.symbol,
            price:
              usd >= 1
                ? `$${usd.toFixed(3)}`
                : usd > 0
                ? `$${usd.toFixed(usd < 0.001 ? 6 : 4)}`
                : `${priceHive.toFixed(6)} HIVE`,
            chg: `${chgNum > 0 ? "+" : ""}${chgNum.toFixed(1)}%`,
            up: chgNum > 0 ? true : chgNum < 0 ? false : null,
          };
        });
      return top;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const base = data ?? [];
  if (base.length === 0) {
    return <div className="h-10 border-b border-border/60 bg-card/40" />;
  }
  const items = [...base, ...base];
  return (
    <div className="group relative h-10 overflow-hidden border-b border-border/60 bg-card/40">
      <div className="flex h-full w-max items-center gap-10 whitespace-nowrap px-6 [animation:marquee_60s_linear_infinite] group-hover:[animation-play-state:paused]">
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono font-semibold text-foreground">{t.sym}</span>
            <span className="font-mono text-muted-foreground">{t.price}</span>
            <span
              className={cn(
                "font-mono",
                t.up === true && "text-success",
                t.up === false && "text-destructive",
                t.up === null && "text-muted-foreground",
              )}
            >
              {t.chg}
            </span>
          </div>
        ))}
      </div>
      <style>{`@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

const SIDEBAR_STYLES =
  "hidden flex-shrink-0 border-r border-border/60 bg-card/30 transition-[width] duration-200 md:flex md:flex-col";

interface ShellProps {
  user: AppUser;
  children: ReactNode;
}

export function AppShell({ user: initialUser, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<AppUser>(initialUser);

  useEffect(() => {
    setUser(initialUser);
    if (!initialUser.username) return;
    fetchPostingJsonMeta(initialUser.username)
      .then((meta) => {
        const profile = (meta?.profile ?? {}) as Record<string, string>;
        const displayName = profile.name?.trim() || "";
        if (!displayName) return;
        setUser((prev) => ({
          ...prev,
          fullName: displayName,
          avatarInitials: displayName.slice(0, 2).toUpperCase(),
        }));
      })
      .catch(() => {
        /* best-effort */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser.username]);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <div className="flex h-full">
        <aside className={cn(SIDEBAR_STYLES, collapsed ? "w-[54px]" : "w-[228px]")}>
          <SidebarBody
            user={user}
            collapsed={collapsed}
            onNavigate={() => setMobileOpen(false)}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[80vw] max-w-[280px] border-0 bg-card p-0"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBody
              user={user}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Menu className="size-4" />
            </button>
            <Link to="/" className="ml-auto flex items-center gap-2 focus:outline-none">
              <BrandLogo className="size-5" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
                HiveX PH
              </span>
            </Link>
            {user.isLoggedIn && <NotificationsBellWrapper username={user.username} />}
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <MarketTicker />
            <div className="mx-auto min-h-full w-full min-w-0 max-w-6xl px-4 py-6 md:px-8 md:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[26px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
