import { useState, type ReactNode } from "react";
import { BookOpen, Check, Copy, ExternalLink, Info, Rocket, Send, Twitter } from "lucide-react";

import Link from "next/link";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getGameMintAddress } from "@/lib/wallet";

// NEXT_PUBLIC_CONTRACT_ADDRESS may be unset in environments where the token
// hasn't launched yet (e.g. local dev) — every consumer below must degrade
// gracefully instead of showing a blank address or a dead pump.fun link.
const TOKEN_ADDRESS = getGameMintAddress();
const hasTokenAddress = TOKEN_ADDRESS.length > 0;

const LINKS = [
  {
    label: "X (Twitter)",
    value: "@soulstudio_sol",
    href: "https://x.com/soulstudio_sol",
    icon: Twitter,
  },
  { label: "Telegram", value: "Soul Studio", href: "https://t.me/+lKT45Pw6adQxNmJl", icon: Send },
  ...(hasTokenAddress
    ? [
        {
          label: "pump.fun",
          value: "Trade $HASH",
          href: `https://pump.fun/coin/${TOKEN_ADDRESS}`,
          icon: Rocket,
        },
      ]
    : []),
];

export function AboutModal({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!hasTokenAddress) return;
    await navigator.clipboard.writeText(TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary">
              <Info className="size-4" />
            </span>
            About $HASH
          </DialogTitle>
          <DialogDescription>
            $HASH is a community token on Solana powering this idle mining game. Follow the links
            below to trade, read the docs, or keep up with announcements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <link.icon className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{link.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{link.value}</p>
              </div>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>

        <DialogClose asChild>
          <Link
            href="/wiki"
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <BookOpen className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">Documentation</p>
              <p className="truncate text-[11px] text-muted-foreground">Read the CryptoCore wiki</p>
            </div>
          </Link>
        </DialogClose>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Token contract
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">
              {hasTokenAddress ? TOKEN_ADDRESS : "Not launched yet"}
            </code>
            <button
              type="button"
              onClick={copyAddress}
              disabled={!hasTokenAddress}
              aria-label="Copy token contract address"
              className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
