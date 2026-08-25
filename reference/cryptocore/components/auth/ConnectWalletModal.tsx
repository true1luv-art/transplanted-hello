import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Loader2, UserRound, CheckCircle2, Gamepad2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuthStore, shortAddress } from "@/features/stores/authStore";
import { usePlayerStore } from "@/features/stores/playerStore";
import { isPhantomInstalled, PHANTOM_INSTALL_URL } from "@/lib/wallet";

const WALLETS = [
  { id: "phantom", name: "Phantom", hint: "Recommended" },
  { id: "solflare", name: "Solflare", hint: "Coming soon", disabled: true },
] as const;

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export function ConnectWalletModal({
  children,
  open,
  onOpenChange,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setOpen = (value: boolean) => {
    if (!isControlled) setInternalOpen(value);
    onOpenChange?.(value);
  };

  const address = useAuthStore((state) => state.address);
  const storedUsername = useAuthStore((state) => state.username);
  const connectWallet = useAuthStore((state) => state.connectWallet);
  const playDemo = useAuthStore((state) => state.playDemo);
  const mode = useAuthStore((state) => state.mode);
  const phantomInstalled = typeof window !== "undefined" && isPhantomInstalled();
  const setUsernameInStore = useAuthStore((state) => state.setUsername);
  const syncPlayerFromApi = usePlayerStore((state) => state.syncFromApi);
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");

  // Step 2 begins only once the wallet handshake succeeded and no name is claimed.
  const step: "wallet" | "username" = address && !storedUsername ? "username" : "wallet";
  const trimmedUsername = username.trim();
  const usernameValid = USERNAME_PATTERN.test(trimmedUsername);

  async function handleConnect() {
    if (!phantomInstalled) {
      window.open(PHANTOM_INSTALL_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setPending(true);
    try {
      await connectWallet();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  function handlePlayDemo() {
    return playDemo();
  }

  async function handleClaimUsername() {
    if (!usernameValid) return;
    setSaving(true);
    await setUsernameInStore(trimmedUsername);
    // Sync authoritative player data from the server before entering the game
    // so the store reflects real DB values (hash=0, vault=0) not initialState defaults.
    if (mode === "wallet") {
      await syncPlayerFromApi();
    }
    setSaving(false);
    setUsername("");
    setOpen(false);
    await router.push("/dashboard");
  }

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(value) => {
        // Username is required before entering the game.
        if (!value && step === "username") return;
        setOpen(value);
      }}
    >
      {children && !isControlled && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent
        className={step === "username" ? "sm:max-w-sm [&>button]:hidden" : "sm:max-w-sm"}

        onEscapeKeyDown={(event) => {
          if (step === "username") event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (step === "username") event.preventDefault();
        }}
      >
        {step === "wallet" ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Wallet className="size-4" />
                </span>
                <span className="font-semibold">Connect wallet</span>
              </div>
              <DialogTitle className="sr-only">Connect your Solana wallet</DialogTitle>
              <DialogDescription>
                Step 1 of 2 — connect your Solana wallet and sign a message to prove ownership. No
                on-chain transaction is made.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {WALLETS.map((wallet) => {
                const isPhantom = wallet.id === "phantom";
                const notInstalled = isPhantom && !phantomInstalled;
                const disabled = pending || "disabled" in wallet;
                const hint =
                  "disabled" in wallet ? wallet.hint : notInstalled ? "Install" : wallet.hint;

                return (
                  <Button
                    key={wallet.id}
                    variant={isPhantom ? "default" : "outline"}
                    className="h-11 w-full justify-between"
                    disabled={disabled && !notInstalled}
                    onClick={handleConnect}
                  >
                    <span className="flex items-center gap-2">
                      {pending && isPhantom ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : notInstalled ? (
                        <ExternalLink className="size-4" />
                      ) : (
                        <Wallet className="size-4" />
                      )}
                      {wallet.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                      {hint}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              variant="outline"
              className="h-11 w-full justify-between"
              disabled={pending}
              onClick={handlePlayDemo}
            >
              <span className="flex items-center gap-2">
                <Gamepad2 className="size-4" />
                Play demo
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                No wallet
              </span>
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Demo mode runs entirely in this browser — progress is stored locally and never synced
              to the server.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                  <UserRound className="size-4" />
                </span>
                <span className="font-semibold">Choose your username</span>
              </div>
              <DialogTitle className="sr-only">Choose your miner username</DialogTitle>
              <DialogDescription>
                Step 2 of 2 — this name is shown to other players instead of your wallet address.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0 text-success" />
              <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">
                {mode === "demo" ? "Demo session ready" : "Wallet connected"}
              </span>
              <span className="shrink-0 font-mono text-[11px]">
                {address ? shortAddress(address) : ""}
              </span>
            </div>

            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleClaimUsername();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="miner-username" className="text-[12px]">
                  Username
                </Label>
                <Input
                  id="miner-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g. satoshi_rig"
                  autoComplete="off"
                  autoFocus
                  maxLength={20}
                  disabled={saving}
                />
                <p className="text-[11px] text-muted-foreground">
                  {username.length === 0
                    ? "Type a name to continue — 3-20 characters: letters, numbers or underscores."
                    : "3-20 characters: letters, numbers or underscores. Must be unique."}
                </p>
              </div>
              <Button
                type="submit"
                className="h-11 w-full gap-2"
                disabled={!usernameValid || saving}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Enter the mine
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
