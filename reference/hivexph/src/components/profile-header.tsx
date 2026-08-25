import Image from "@/components/next-image-shim";
import { ExternalLink, BadgeCheck } from "lucide-react";
import { hiveAvatarUrl, hiveCoverUrl } from '@/lib/fetchers/hive-account-helpers';
import { HIVE_CONFIG } from '@/lib/config/api';

interface ProfileHeaderProps {
  username: string;
  displayName: string;
  about?: string;
  extraActions?: React.ReactNode;
  /** Optional stat tiles shown across the bottom of the header card */
  stats?: Array<{ label: string; value: string; accent?: "default" | "emerald"; node?: React.ReactNode }>;
  /** Show "Verified Trader" pill next to handle */
  verified?: boolean;
}

export function ProfileHeader({
  username,
  displayName,
  about,
  extraActions,
  stats,
  verified,
}: ProfileHeaderProps) {
  const coverImage = hiveCoverUrl(username);
  const avatarImage = hiveAvatarUrl(username);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl md:rounded-[2.5rem]">
      {/* Cover banner */}
      <div className="relative h-44 md:h-60">
        <Image
          src={coverImage}
          alt="Profile cover"
          fill
          className="object-cover opacity-80"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
      </div>

      {/* Identity row */}
      <div className="relative -mt-14 flex flex-col gap-6 px-5 pb-6 md:-mt-16 md:flex-row md:items-end md:justify-between md:px-8 md:pb-8">
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-end">
          {/* Avatar with gradient ring + status dot */}
          <div className="relative">
            <div className="size-28 rounded-full bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-400 p-[3px] shadow-xl md:size-36">
              <div className="relative size-full overflow-hidden rounded-full border-4 border-card bg-muted">
                <Image
                  src={avatarImage}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="144px"
                />
              </div>
            </div>
          </div>

          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-muted-foreground md:justify-start">
              <span className="font-mono">@{username}</span>
              {verified && (
                <span className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  <BadgeCheck className="size-3" />
                  Verified
                </span>
              )}
            </p>
            {about && (
              <p className="mt-2 max-w-md text-sm text-foreground/80">{about}</p>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-center gap-2 md:justify-end">
          {extraActions}
          <a
            href={`${HIVE_CONFIG.peakdUrl}/@${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted md:text-sm"
          >
            <ExternalLink className="size-3.5" />
            View on PeakD
          </a>
        </div>
      </div>

      {/* Stat tiles bar */}
      {stats && stats.length > 0 && (
        <div
          className="grid border-t border-border/60"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`p-4 text-center md:p-6 ${i < stats.length - 1 ? "border-r border-border/60" : ""}`}
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              {s.node ? (
                <div className="flex items-center justify-center">{s.node}</div>
              ) : (
                <p
                  className={`text-lg font-bold tracking-tight md:text-2xl ${s.accent === "emerald" ? "text-emerald-400" : "text-foreground"}`}
                >
                  {s.value}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
