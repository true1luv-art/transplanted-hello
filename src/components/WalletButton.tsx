import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  LogOut,
  Images,
  Activity as ActivityIcon,
  Wallet,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hive } from "@/lib/format";
import { useAppStore } from "@/features/stores/app-store";
import { LoginModal } from "@/components/LoginModal";

export function WalletButton() {
  const user = useAppStore((s) => s.user);
  const connected = useAppStore((s) => s.walletConnected);
  const connecting = useAppStore((s) => s.connecting);
  const balance = useAppStore((s) => (s.user ? (s.balances[s.user.username] ?? s.hiveBalance) : 0));
  const disconnectWallet = useAppStore((s) => s.disconnectWallet);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  if (!connected || !user) {
    return (
      <>
        <Button onClick={() => setLoginOpen(true)} disabled={connecting} className="gap-2">
          {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
          {connecting ? "Connecting" : "Connect Hive Wallet"}
        </Button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full border border-border bg-surface py-1.5 pr-3 pl-1.5 text-left transition-colors hover:border-border-strong">
          {avatarFailed ? (
            <span className="gradient-ember grid size-8 place-items-center rounded-full font-display text-sm font-bold text-primary-foreground">
              {user.username.charAt(0).toUpperCase()}
            </span>
          ) : (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="size-8 rounded-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          )}
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium">@{user.username}</span>
            <span className="block text-[11px] text-muted-foreground">{hive(balance)}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="text-xs text-muted-foreground">Account</p>
          <p className="text-sm font-medium">@{user.username}</p>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="font-display text-base font-semibold">{hive(balance)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to="/@{$username}/creator"
            params={{ username: user.username }}
            className="cursor-pointer"
          >
            <Sparkles className="size-4" /> Creator
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/@{$username}/nfts"
            params={{ username: user.username }}
            className="cursor-pointer"
          >
            <Images className="size-4" /> My NFTs
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/activity" className="cursor-pointer">
            <ActivityIcon className="size-4" /> Activity
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={async () => {
            await disconnectWallet();
            toast("Wallet disconnected");
          }}
        >
          <LogOut className="size-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
