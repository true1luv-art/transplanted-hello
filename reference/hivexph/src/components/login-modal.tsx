/**
 * LoginModal — Phase 6 real Hive Keychain flow.
 *
 * Asks Keychain to sign a buffer with the user's Posting key, then posts
 * the result to `loginFn` which writes an encrypted httpOnly session
 * cookie. After success, invalidates the router so `_app` reloads the
 * session and shows the signed-in shell.
 */

import { type ReactNode, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Repeat2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, type LoginFormValues } from "@/lib/context/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { loginFn } from "@/lib/auth.functions";

interface LoginModalProps {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LoginModal({ children, open, onOpenChange }: LoginModalProps) {
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

  const [username, setUsername] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  function reset() {
    setUsername("");
    setFieldError(null);
    setIsConnecting(false);
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    setOpen(val);
  }

  function validate(): LoginFormValues | null {
    const result = loginSchema.safeParse({ username });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Invalid username.");
      return null;
    }
    setFieldError(null);
    return result.data;
  }

  async function handleKeychain() {
    const data = validate();
    if (!data) return;
    setIsConnecting(true);
    try {
      const message = JSON.stringify({ app: "hivep2p", ts: Date.now() });
      const res = await login(data.username);
      const signature =
        (res?.result as string | undefined) ?? (res?.message as string | undefined) ?? "";
      if (!signature) throw new Error("Keychain did not return a signature.");
      await callLogin({ data: { username: data.username, signature, message } });
      toast.success(`Signed in as @${data.username}`);
      setOpen(false);
      await router.invalidate();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Keychain request was cancelled or failed.";
      setFieldError(msg);
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
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Repeat2 className="h-4 w-4" />
            </div>
            <span className="font-semibold">HiveX PH</span>
          </div>
          <DialogTitle className="sr-only">Sign in</DialogTitle>
          <DialogDescription className="sr-only">
            Enter your Hive username and connect with Keychain to start trading.
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
              onKeyDown={(e) => e.key === "Enter" && handleKeychain()}
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

          <Button className="w-full" onClick={handleKeychain} disabled={isConnecting}>
            {isConnecting ? (
              "Waiting for Keychain\u2026"
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Connect with Keychain
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Install the{" "}
            <a
              href="https://hive-keychain.com/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Hive Keychain
            </a>{" "}
            browser extension first.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
