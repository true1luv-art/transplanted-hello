"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LevelBadge } from "@/components/game/PlayerLevelHeader";
import { ReferralModal } from "@/components/game/ReferralModal";
import { cn } from "@/lib/utils";
import { shortAddress, useAuthStore } from "@/features/stores/authStore";
import { usePlayerStore } from "@/features/stores/playerStore";

export function AccountDropdown({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const address = useAuthStore((state) => state.address);
  const username = useAuthStore((state) => state.username);
  const disconnect = useAuthStore((state) => state.disconnect);
  const xp = usePlayerStore((state) => state.xp);
  const [referralOpen, setReferralOpen] = useState(false);

  if (!address) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-accent focus:outline-none",
            collapsed && "justify-center",
          )}
        >
          <span className="size-7 shrink-0 rounded-full bg-gradient-to-tr from-primary via-accent to-success p-[2px]">
            <span className="grid size-full place-items-center overflow-hidden rounded-full bg-secondary font-mono text-[10px] font-bold uppercase text-primary-foreground">
              {(username ?? address).slice(0, 2)}
            </span>
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                <span className="truncate">{username ?? "Miner"}</span>
                <LevelBadge xp={xp} />
              </span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">
                {shortAddress(address)}
              </span>
            </span>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="bottom" className="w-56">
          <div className="px-1.5 py-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{username ?? "Miner"}</span>
              <LevelBadge xp={xp} />
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{address}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard?.writeText(address);
                toast.success("Address copied");
              }}
            >
              <Copy className="size-3.5" />
              Copy address
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/profile")}>
              <UserRound className="size-3.5" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setReferralOpen(true)}>
              <Users className="size-3.5" />
              Referrals
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => {
              disconnect();
              router.push("/");
              toast("Wallet disconnected");
            }}
          >
            <LogOut className="size-3.5" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReferralModal open={referralOpen} onClose={() => setReferralOpen(false)} />
    </>
  );
}
