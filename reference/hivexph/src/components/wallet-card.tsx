import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import axios from "axios";
import { getHiveAccount } from "@/lib/fetchers/hive-account-helpers";
import { HIVE_ENGINE_CONFIG } from "@/lib/config/api";
import { cn } from "@/lib/utils";

interface Props {
  username: string;
  collapsed?: boolean;
}

interface Balances {
  hive: number;
  hbd: number;
  totalUsd: number;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.split(" ")[0]) || 0;
}

export function WalletCard({ username, collapsed }: Props) {
  const [data, setData] = useState<Balances | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const [account, priceRes] = await Promise.all([
          getHiveAccount(username),
          axios
            .get<{ hive: { usd: number }; hive_dollar: { usd: number } }>(
              HIVE_ENGINE_CONFIG.coingeckoUrl.replace("ids=hive", "ids=hive,hive_dollar"),
            )
            .then((r) => r.data)
            .catch(() => ({ hive: { usd: 0 }, hive_dollar: { usd: 1 } })),
        ]);
        if (cancelled || !account) return;
        const hive = parseAmount(account.balance);
        const hbd = parseAmount(account.hbd_balance);
        const hiveUsd = priceRes.hive?.usd ?? 0;
        const hbdUsd = priceRes.hive_dollar?.usd ?? 1;
        setData({ hive, hbd, totalUsd: hive * hiveUsd + hbd * hbdUsd });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (collapsed) {
    return (
      <Link
        to="/wallet/$username"
        params={{ username }}
        title="Wallet"
        className="mx-auto mb-2 flex size-9 items-center justify-center rounded-md border border-border/60 bg-card/50 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
      >
        <Wallet className="size-4" />
      </Link>
    );
  }

  return (
    <Link
      to="/wallet/$username"
      params={{ username }}
      className={cn(
        "group relative mx-2 mb-2 block overflow-hidden rounded-xl p-3 transition-all duration-300",
        "border border-red-400/30 hover:border-red-300/60",
        "bg-gradient-to-br from-red-600/40 via-red-700/30 to-red-950/50",
        "shadow-[0_8px_24px_-8px_rgba(220,38,38,0.45),inset_0_1px_0_0_rgba(255,255,255,0.12)]",
        "backdrop-blur-xl hover:shadow-[0_12px_32px_-8px_rgba(220,38,38,0.6),inset_0_1px_0_0_rgba(255,255,255,0.18)]",
      )}
    >
      {/* Glass highlights */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-red-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 size-20 rounded-full bg-rose-500/30 blur-2xl" />
      {/* Sheen */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div className="relative">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-red-50/90">
            Wallet
          </span>
          <Wallet className="size-3 text-red-100/80 group-hover:text-white" />
        </div>
        <div className="mb-2.5">
          <p className="font-mono text-[9px] uppercase tracking-wider text-red-100/70">
            Total Value
          </p>
          <p className="font-mono text-[17px] font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            {data ? `$${data.totalUsd.toFixed(2)}` : "—"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 border-t border-white/15 pt-1.5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-red-100/70">
              HIVE
            </p>
            <p className="font-mono text-[11px] font-semibold tabular-nums text-white">
              {data ? data.hive.toFixed(3) : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-red-100/70">
              HBD
            </p>
            <p className="font-mono text-[11px] font-semibold tabular-nums text-white">
              {data ? data.hbd.toFixed(3) : "—"}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
