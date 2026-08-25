/**
 * LoginModal — Hive username sign-in.
 *
 * Mirrors the hivexph Keychain login modal, but the Keychain signature step is
 * simulated: we validate the username, show a short "waiting for Keychain"
 * state, then store the username as the session identity. Any Hive username
 * works and its real profile data is hydrated after sign-in.
 */
import { type ReactNode, useState } from "react";
import { KeyRound } from "lucide-react";
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
import { normalizeHiveUsername } from "@/lib/chain/identity";
import { useAppStore } from "@/features/stores/app-store";

interface LoginModalProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const USERNAME_RE = /^[a-z][a-z0-9.-]{2,15}$/;

export function LoginModal({ children, open, onOpenChange }: LoginModalProps) {
  const connectWallet = useAppStore((s) => s.connectWallet);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;

  const [username, setUsername] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  function setOpen(val: boolean) {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      setUsername("");
      setFieldError(null);
      setIsConnecting(false);
    }
    setOpen(val);
  }

  async function handleKeychain() {
    const name = normalizeHiveUsername(username);
    if (!USERNAME_RE.test(name)) {
      setFieldError("Enter a valid Hive username (3-16 characters, letters first).");
      return;
    }
    setFieldError(null);
    setIsConnecting(true);
    try {
      // Simulated Keychain ownership prompt — no signature is verified.
      await new Promise((resolve) => setTimeout(resolve, 600));
      await connectWallet(name);
      toast.success("Wallet connected", { description: `Signed in as @${name}` });
      handleOpenChange(false);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Sign in failed. Try again.");
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {children && !isControlled && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <img src="/assets/hivex-logo.png" alt="" className="size-8 rounded-lg object-contain" />
            <span className="font-display font-semibold">HiveX NFTs</span>
          </div>
          <DialogTitle>Sign in with Hive</DialogTitle>
          <DialogDescription>
            Enter your Hive username. Keychain will ask you to confirm ownership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="hive-username">Hive username</Label>
            <Input
              id="hive-username"
              placeholder="@username"
              value={username}
              onChange={(e) => {
                setFieldError(null);
                setUsername(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && void handleKeychain()}
              autoComplete="username"
              spellCheck={false}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "login-error" : undefined}
            />
          </div>

          {fieldError && (
            <p
              id="login-error"
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {fieldError}
            </p>
          )}

          <Button className="w-full" onClick={() => void handleKeychain()} disabled={isConnecting}>
            {isConnecting ? (
              "Waiting for Keychain\u2026"
            ) : (
              <>
                <KeyRound className="mr-2 size-4" />
                Connect with Keychain
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Demo mode: ownership verification is skipped, any Hive username signs in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
