/**
 * Hive account header used by the portfolio page.
 *
 * Presentation only: banner, avatar, handle and profile metadata all come from
 * the session user record, which is hydrated with real Hive account data.
 */
import { useState } from "react";
import { BadgeCheck, Globe, MapPin } from "lucide-react";

import type { User } from "@/features/types/domain/users";

/** Minimal profile shape: works for the session user and for visited accounts. */
export type ProfileHeaderUser = Pick<User, "username" | "displayName" | "avatarUrl"> &
  Partial<Pick<User, "coverImage" | "about" | "location" | "website" | "chainSynced">>;

interface ProfileHeaderProps {
  user: ProfileHeaderUser;
  stats?: Array<{ label: string; value: string }>;
}

export function ProfileHeader({ user, stats }: ProfileHeaderProps) {
  // Hive image CDN can be unavailable; fall back to brand visuals.
  const [coverFailed, setCoverFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <section className="surface-card overflow-hidden">
      <div className="relative h-28 sm:h-40">
        {user.coverImage && !coverFailed ? (
          <img
            src={user.coverImage}
            alt={`${user.displayName} profile banner`}
            className="size-full object-cover"
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <div className="gradient-ember size-full opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
      </div>

      <div className="relative -mt-10 flex flex-col gap-4 px-5 pb-5 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          {avatarFailed ? (
            <span className="gradient-ember grid size-20 place-items-center rounded-full border-4 border-surface font-display text-2xl font-bold text-primary-foreground sm:size-24">
              {user.username.charAt(0).toUpperCase()}
            </span>
          ) : (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="size-20 rounded-full border-4 border-surface bg-surface object-cover sm:size-24"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <div className="pb-1">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{user.displayName}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">@{user.username}</span>
              {user.chainSynced ? (
                <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                  <BadgeCheck className="size-3" />
                  Hive
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {(user.about || user.location || user.website) && (
        <div className="space-y-2 px-5 pb-5 text-sm">
          {user.about ? <p className="max-w-2xl text-foreground/80">{user.about}</p> : null}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {user.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {user.location}
              </span>
            ) : null}
            {user.website ? (
              <a
                href={user.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Globe className="size-3.5" />
                {user.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
        </div>
      )}

      {stats && stats.length > 0 && (
        <div
          className="grid border-t border-border"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`p-4 text-center ${i < stats.length - 1 ? "border-r border-border" : ""}`}
            >
              <p className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                {s.label}
              </p>
              <p className="font-display text-lg font-bold sm:text-xl">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
