import { useEffect, useMemo, useState } from "react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PrivateKey } from "@hiveio/dhive";
import {
  UserPlus,
  Sparkles,
  Copy,
  Download,
  ShieldAlert,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { HIVE_CONFIG } from "@/lib/config/api";
import { fetchTokenBalance } from "@/lib/fetchers/balances";

const appRoute = getRouteApi("/_app");

/** HIVEX burned per new account. Placeholder until oracle/engine sets it. */
const ACCOUNT_PRICE_HIVEX = 50;


export const Route = createFileRoute("/_app/tools/accounts")({
  head: () => ({
    meta: [
      { title: "Create a Hive Account — HiveX Tools" },
      {
        name: "description",
        content:
          "Mint a brand-new Hive account using an Account Creation Token funded by the HiveX engine. Keys generated locally in your browser.",
      },
    ],
  }),
  component: AccountsPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const USERNAME_RE = /^[a-z][a-z0-9.-]{2,15}$/;

function validateUsername(name: string): string | null {
  if (!name) return "Required";
  if (name.length < 3) return "Too short (min 3)";
  if (name.length > 16) return "Too long (max 16)";
  if (!USERNAME_RE.test(name))
    return "Lowercase letters, digits, '.' or '-'; must start with a letter";
  if (name.includes("..") || name.includes("--")) return "No consecutive separators";
  return null;
}

async function checkAvailability(name: string): Promise<"available" | "taken"> {
  const { data } = await axios.post<{ result: unknown[] }>(HIVE_CONFIG.apiUrl, {
    jsonrpc: "2.0",
    id: 1,
    method: "condenser_api.get_accounts",
    params: [[name]],
  });
  return (data?.result?.length ?? 0) > 0 ? "taken" : "available";
}

type Keys = {
  master: string;
  owner: { pub: string; priv: string };
  active: { pub: string; priv: string };
  posting: { pub: string; priv: string };
  memo: { pub: string; priv: string };
};

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // Base64-ish, prefixed for legibility
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "")
    .replace(/\//g, "")
    .replace(/=/g, "");
  return `P${b64.slice(0, 50)}`;
}

function deriveKeys(username: string, password: string): Keys {
  const roles = ["owner", "active", "posting", "memo"] as const;
  const out = {} as Record<(typeof roles)[number], { pub: string; priv: string }>;
  for (const role of roles) {
    const priv = PrivateKey.fromLogin(username, password, role);
    out[role] = {
      priv: priv.toString(),
      pub: priv.createPublic().toString(),
    };
  }
  return { master: password, ...out };
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 px-2"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function KeyRow({
  label,
  pub,
  priv,
}: {
  label: string;
  pub: string;
  priv: string;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
          Public
        </span>
        <code className="flex-1 truncate font-mono text-xs text-foreground">{pub}</code>
        <CopyButton value={pub} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
          Private
        </span>
        <code className="flex-1 truncate font-mono text-xs text-foreground">{priv}</code>
        <CopyButton value={priv} />
      </div>
    </div>
  );
}

function AccountsPage() {
  const [username, setUsername] = useState("");
  const [debounced, setDebounced] = useState("");
  const [keys, setKeys] = useState<Keys | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "demo" | "error"
  >("idle");
  const [submitMsg, setSubmitMsg] = useState<string>("");

  const { user } = appRoute.useLoaderData();

  const { data: hivexBalance } = useQuery({
    queryKey: ["he-balance", user.username, "HIVEX"],
    queryFn: () => fetchTokenBalance(user.username, "HIVEX"),
    enabled: !!user.isLoggedIn && !!user.username,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const balance = hivexBalance ?? 0;
  const canAfford = user.isLoggedIn && balance >= ACCOUNT_PRICE_HIVEX;


  const usernameError = useMemo(() => validateUsername(username), [username]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(username), 400);
    return () => clearTimeout(id);
  }, [username]);

  const availabilityQuery = useQuery({
    queryKey: ["hive-username-available", debounced],
    queryFn: () => checkAvailability(debounced),
    enabled: !!debounced && !validateUsername(debounced),
    staleTime: 30_000,
  });

  const available =
    availabilityQuery.data === "available" && !usernameError && debounced === username;

  function handleGenerate() {
    if (!available) return;
    const password = randomPassword();
    setKeys(deriveKeys(username, password));
    setAcknowledged(false);
    setSubmitState("idle");
    setSubmitMsg("");
  }

  function handleDownload() {
    if (!keys) return;
    const payload = `Hive Account Keys — generated by HiveX Tools
Account: ${username}
Created: ${new Date().toISOString()}

!!! KEEP THIS FILE SECRET — anyone with these keys controls the account !!!

Master Password:
${keys.master}

Owner   PUBLIC:  ${keys.owner.pub}
Owner   PRIVATE: ${keys.owner.priv}

Active  PUBLIC:  ${keys.active.pub}
Active  PRIVATE: ${keys.active.priv}

Posting PUBLIC:  ${keys.posting.pub}
Posting PRIVATE: ${keys.posting.priv}

Memo    PUBLIC:  ${keys.memo.pub}
Memo    PRIVATE: ${keys.memo.priv}
`;
    const blob = new Blob([payload], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hive-keys-${username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleCreate() {
    if (!keys || !acknowledged) return;
    setSubmitState("submitting");
    setSubmitMsg("");
    try {
      const res = await axios.post(
        "/api/public/tools/accounts/create",
        {
          new_account: username,
          owner: keys.owner.pub,
          active: keys.active.pub,
          posting: keys.posting.pub,
          memo: keys.memo.pub,
        },
        { timeout: 8000 },
      );
      if (res.data?.ok) {
        setSubmitState("demo");
        setSubmitMsg(`Account submitted. tx: ${res.data.tx_id ?? "n/a"}`);
      } else {
        setSubmitState("demo");
        setSubmitMsg(
          "Backend not connected yet — your keys are generated and saved locally. Account creation will run once the engine is live.",
        );
      }
    } catch {
      setSubmitState("demo");
      setSubmitMsg(
        "Backend not connected yet — your keys are generated and saved locally. Account creation will run once the engine is live.",
      );
    }
  }

  const stats = [
    {
      label: "YOUR HIVEX BALANCE",
      value: user.isLoggedIn
        ? `${balance.toLocaleString(undefined, { maximumFractionDigits: 3 })} HIVEX`
        : "—",
    },
    {
      label: "PRICE PER ACCOUNT",
      value: `${ACCOUNT_PRICE_HIVEX.toLocaleString()} HIVEX`,
    },
    {
      label: "AFTER CREATION",
      value: user.isLoggedIn
        ? `${Math.max(0, balance - ACCOUNT_PRICE_HIVEX).toLocaleString(undefined, { maximumFractionDigits: 3 })} HIVEX`
        : "—",
    },
  ];


  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserPlus}
        title="Create Hive Account"
        description="Mint a brand-new Hive account using a HiveX-funded Account Creation Token. Keys are generated in your browser — we never see your private keys."
        stats={stats}
        action={
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            Demo Preview
          </Badge>
        }
      />

      <Card className="border-border/60 bg-card/40 p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label htmlFor="new-username">Desired username</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  id="new-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="my-new-account"
                  className="font-mono pr-9"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {availabilityQuery.isFetching && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                  {!availabilityQuery.isFetching &&
                    debounced &&
                    !usernameError &&
                    availabilityQuery.data === "available" && (
                      <Check className="size-4 text-emerald-500" />
                    )}
                  {!availabilityQuery.isFetching &&
                    debounced &&
                    !usernameError &&
                    availabilityQuery.data === "taken" && (
                      <X className="size-4 text-destructive" />
                    )}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!available}
              >
                Generate keys
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {usernameError
                ? usernameError
                : availabilityQuery.data === "taken"
                  ? "@" + debounced + " is already taken."
                  : availabilityQuery.data === "available"
                    ? "@" + debounced + " is available."
                    : "3–16 chars, lowercase, may include digits, '.' or '-'."}
            </p>
          </div>
        </div>
      </Card>

      {keys && (
        <Card className="border-border/60 bg-card/40 p-6">
          <div className="mb-4 flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">
                Save these keys NOW
              </h2>
              <p className="text-xs text-muted-foreground">
                Generated locally in your browser. We never receive your private
                keys or master password. If you lose them, your account is
                unrecoverable.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Master Password
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-xs text-foreground">
                  {keys.master}
                </code>
                <CopyButton value={keys.master} />
              </div>
            </div>
            <KeyRow label="Owner" pub={keys.owner.pub} priv={keys.owner.priv} />
            <KeyRow label="Active" pub={keys.active.pub} priv={keys.active.priv} />
            <KeyRow label="Posting" pub={keys.posting.pub} priv={keys.posting.priv} />
            <KeyRow label="Memo" pub={keys.memo.pub} priv={keys.memo.priv} />
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-start gap-2 text-xs text-muted-foreground sm:items-center">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 sm:mt-0"
              />
              I have saved my keys somewhere safe.
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="size-4" />
                Download .txt
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!acknowledged || !canAfford || submitState === "submitting"}
              >
                {submitState === "submitting" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {!user.isLoggedIn
                  ? "Sign in to create"
                  : !canAfford
                    ? `Need ${ACCOUNT_PRICE_HIVEX} HIVEX`
                    : `Create @${username} — ${ACCOUNT_PRICE_HIVEX} HIVEX`}
              </Button>

            </div>
          </div>

          {submitMsg && (
            <p
              className={
                "mt-4 rounded-md border px-3 py-2 text-xs " +
                (submitState === "error"
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-border/60 bg-card/60 text-muted-foreground")
              }
            >
              {submitMsg}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}