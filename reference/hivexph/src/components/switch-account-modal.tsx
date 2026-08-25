/**
 * SwitchAccountModal — Manage multiple Hive accounts saved in localStorage.
 *
 * Lists accounts the user has previously signed in with. Switching or adding
 * an account requires a fresh Keychain signature (so the server session
 * cookie is re-issued for that username). Removing an account just deletes
 * it from local storage.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { STORAGE_KEYS } from "@/lib/config/config";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { loginFn, switchAccountFn } from "@/lib/auth.functions";
import { hiveAvatarUrl } from "@/lib/fetchers/hive-account-helpers";

function loadAccounts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.accounts);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveAccounts(list: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(list));
}

interface Props {
  children?: ReactNode;
  currentUsername?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SwitchAccountModal({ children, currentUsername, open, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setOpen = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  };

  const router = useRouter();
  const { login } = useHiveKeychain();
  const callLogin = useServerFn(loginFn);
  const callSwitch = useServerFn(switchAccountFn);

  const [accounts, setAccounts] = useState<string[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (dialogOpen) setAccounts(loadAccounts());
  }, [dialogOpen]);

  // Ensure current account is in the list
  useEffect(() => {
    if (!currentUsername) return;
    const existing = loadAccounts();
    if (!existing.includes(currentUsername)) {
      const updated = [currentUsername, ...existing];
      saveAccounts(updated);
      setAccounts(updated);
    }
  }, [currentUsername]);

  async function switchToAccount(username: string) {
    const clean = username.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9.\-]{3,16}$/.test(clean)) {
      toast.error("Invalid Hive username.");
      return;
    }
    setBusy(clean);
    try {
      await callSwitch({ data: { username: clean } });
      toast.success(`Switched to @${clean}`);
      setOpen(false);
      await router.invalidate();
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Switch failed.";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function authenticate(username: string) {
    const clean = username.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9.\-]{3,16}$/.test(clean)) {
      toast.error("Invalid Hive username.");
      return;
    }
    setBusy(clean);
    try {
      const message = JSON.stringify({ app: "hivep2p", ts: Date.now() });
      const res = await login(clean);
      const signature =
        (res?.result as string | undefined) ?? (res?.message as string | undefined) ?? "";
      if (!signature) throw new Error("Keychain did not return a signature.");
      await callLogin({ data: { username: clean, signature, message } });

      const existing = loadAccounts();
      const updated = existing.includes(clean) ? existing : [...existing, clean];
      saveAccounts(updated);
      setAccounts(updated);

      toast.success(`Signed in as @${clean}`);
      setNewUsername("");
      setOpen(false);
      await router.invalidate();
      // Force route data reload to reflect new user
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Keychain request failed.";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  function removeAccount(username: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = accounts.filter((u) => u !== username);
    saveAccounts(updated);
    setAccounts(updated);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setOpen}>
      {children && !isControlled && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Switch Account</DialogTitle>
          <DialogDescription>
            Manage your saved Hive accounts. Adding a new account requires a Keychain signature.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {accounts.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No saved accounts yet. Add one below.
            </p>
          )}
          {accounts.map((username) => {
            const isCurrent = username === currentUsername;
            const isBusy = busy === username;
            return (
              <button
                key={username}
                type="button"
                disabled={isBusy}
                onClick={() => !isCurrent && switchToAccount(username)}
                className={cn(
                  "group flex items-center gap-2 rounded-full border px-2.5 py-1 text-[13px] font-medium transition",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                  isBusy && "opacity-60",
                )}
              >
                <img
                  src={hiveAvatarUrl(username)}
                  alt=""
                  className="size-6 rounded-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <span>{username}</span>
                {isCurrent ? (
                  <Check className="size-3.5" />
                ) : (
                  <span
                    role="button"
                    aria-label={`Remove ${username}`}
                    onClick={(e) => removeAccount(username, e)}
                    className="rounded-full p-0.5 text-destructive hover:bg-destructive/10"
                  >
                    <X className="size-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="add-account">Add Account</Label>
          <div className="flex gap-2">
            <Input
              id="add-account"
              placeholder="Hive username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && authenticate(newUsername)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy !== null}
            />
            <Button
              type="button"
              onClick={() => authenticate(newUsername)}
              disabled={busy !== null || !newUsername.trim()}
            >
              <Plus className="mr-1 size-3.5" />
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}