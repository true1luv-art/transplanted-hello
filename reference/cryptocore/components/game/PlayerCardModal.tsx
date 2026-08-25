import { ExternalLink, Flame, Star, Vault as VaultIcon } from "lucide-react";

import { StatUpgradeCard } from "@/components/game/StatUpgradeCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RARITY_META, SLOT_META, STAT_META } from "@/features/constants/game";
import { formatHash, formatInt, formatPercent } from "@/lib/format";
import { slotIcon, statIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { shortAddress } from "@/features/stores/authStore";
import type { Equipment, StatKey } from "@/features/types/game";
import { getAvatarByTemplateId, DEFAULT_AVATAR_TEMPLATE_ID } from "@/features/templates/avatars";
import { getBannerByTemplateId, DEFAULT_BANNER_TEMPLATE_ID } from "@/features/templates/banners";

export interface PlayerCardProfile {
  username: string;
  level: number;
  claims: number;
  attacks: number;
  vault: number;
  /** Max vault capacity — powers the "Vault size" card. */
  capacity?: number | undefined;
  /** HASH sent to Notoriety — powers the "Notoriety" card. */
  notoriety?: number | undefined;
  /** HASH mined per second, shown under Vault / Hash rate. */
  perSecond?: number | undefined;
  /** Solana wallet address — links to Solscan. */
  address?: string | undefined;
  stats: Partial<Record<StatKey, number>>;
  equipped: Equipment[];
  /** Numeric cosmetic template IDs — default to 0 / 100 on registration. */
  avatar?: number;
  banner?: number;
  /** Tailwind gradient/border classes for the purchasable avatar ring. */
  borderClassName?: string | undefined;
}

interface PlayerCardModalProps {
  profile: PlayerCardProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CORE_KEYS = ["hashRate", "hackPower", "security"] as const;

/**
 * General player card — used for raid targets today and for the signed-in
 * player's own public profile later. Banner, avatar and ring are isolated so
 * purchasable cosmetics can slot straight in.
 */
export function PlayerCardModal({ profile, open, onOpenChange }: PlayerCardModalProps) {
  if (!profile) return null;

  const initials = profile.username.slice(0, 2).toUpperCase();
  const slots = profile.equipped;
  const capacity = profile.capacity ?? 0;
  const avatarImage = getAvatarByTemplateId(profile.avatar ?? DEFAULT_AVATAR_TEMPLATE_ID)?.image;
  const bannerImage = getBannerByTemplateId(profile.banner ?? DEFAULT_BANNER_TEMPLATE_ID)?.image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-border/60 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{profile.username}</DialogTitle>
        </DialogHeader>

        {/* Cover banner */}
        <div className="relative h-28 bg-gradient-to-tr from-primary/25 via-accent/20 to-secondary sm:h-36">
          {bannerImage ? <img src={bannerImage} alt="" className="size-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        </div>

        {/* Identity row */}
        <div className="relative -mt-12 flex flex-col items-center gap-4 px-5 sm:-mt-14 sm:flex-row sm:items-end sm:px-7">
          <div
            className={cn(
              "size-24 rounded-full p-[3px] shadow-xl sm:size-28",
              profile.borderClassName ?? "bg-gradient-to-tr from-primary via-accent to-success",
            )}
          >
            <div className="grid size-full place-items-center overflow-hidden rounded-full border-4 border-card bg-secondary text-xl font-semibold text-primary-foreground">
              {avatarImage ? (
                <img src={avatarImage} alt={profile.username} className="size-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>
          <div className="min-w-0 pb-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{profile.username}</h2>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-xs font-semibold leading-none text-warning"
                title={`Level ${profile.level}`}
              >
                <Star className="size-3 fill-current" />
                {profile.level}
              </span>
            </div>
            <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:justify-start">
              {profile.address ? (
                <a
                  href={`https://solscan.io/account/${profile.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-foreground/80 transition-colors hover:text-primary"
                >
                  {shortAddress(profile.address)}
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
              <span>Claims: {formatInt(profile.claims)}</span>
              <span>Attacks: {formatInt(profile.attacks)}</span>
            </p>
          </div>
        </div>

        {/* Stat cards — same layout as the profile page */}
        <div className="grid gap-3 px-5 pt-5 sm:grid-cols-2 sm:px-7 xl:grid-cols-3">
          <StatUpgradeCard
            title="Vault"
            value={formatHash(profile.vault, 0)}
            unit="HASH"
            icon={VaultIcon}
            meta={
              <div className="space-y-1">
                {capacity > 0 ? (
                  <div>
                    of {formatHash(capacity, 0)} capacity ·{" "}
                    {formatPercent(Math.min(100, (profile.vault / capacity) * 100), 1)} full
                  </div>
                ) : null}
                {profile.perSecond !== undefined ? (
                  <div className="text-primary">{formatHash(profile.perSecond, 4)} HASH / sec</div>
                ) : null}
              </div>
            }
          />

          <StatUpgradeCard
            title="Vault size"
            value={capacity > 0 ? formatHash(capacity, 0) : "—"}
            {...(capacity > 0 ? { unit: "HASH" } : {})}
            icon={VaultIcon}
            meta={
              <div className="space-y-1">
                <div className="text-primary">+{(profile.stats.luck ?? 0).toFixed(3)}% Luck</div>
                <div className="text-primary">
                  +{(profile.stats.firewall ?? 0).toFixed(3)}% Firewall
                </div>
              </div>
            }
          />

          <StatUpgradeCard
            title="Notoriety"
            value={formatInt(profile.notoriety ?? 0)}
            icon={Flame}
            meta={
              <div className="space-y-1">
                <div>Send HASH to Notoriety to unlock Exploit and future content.</div>
                <div className="text-primary">
                  +{(profile.stats.exploit ?? 0).toFixed(3)}% Exploit
                </div>
              </div>
            }
          />

          {CORE_KEYS.map((key) => {
            const Icon = statIcon(key);
            const value = profile.stats[key] ?? 0;
            return (
              <StatUpgradeCard
                key={key}
                title={STAT_META[key].label}
                value={key === "hashRate" ? `${formatInt(value)} H/s` : formatInt(value)}
                icon={Icon}
                meta={
                  <div className="space-y-1">
                    <div>
                      {key === "hashRate"
                        ? "Mining throughput"
                        : key === "hackPower"
                          ? `Can raid targets with Security below ${formatInt(value)}`
                          : `Blocks raiders with Hack Power up to ${formatInt(value)}`}
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>

        {/* Equipped gear */}
        <div className="px-5 py-5 sm:px-7">
          <p className="mb-3 text-sm font-semibold">
            Equipped gear{" "}
            <span className="text-muted-foreground">
              ({slots.length} / {Object.keys(SLOT_META).length})
            </span>
          </p>
          {slots.length === 0 ? (
            <p className="card-soft border-dashed p-4 text-sm text-muted-foreground">
              No gear equipped.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {slots.map((item) => {
                const Icon = slotIcon(item.slot);
                const rarity = RARITY_META[item.rarity];
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "card-soft flex items-center gap-3 p-3 ring-1 ring-inset",
                      rarity.ringClass,
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl",
                        rarity.bgClass,
                        rarity.textClass,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {SLOT_META[item.slot].label}
                      </p>
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className={cn("text-[11px] font-medium", rarity.textClass)}>
                        {rarity.label} · Lv {item.level}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
