"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Boxes,
  Flame,
  Gem,
  Landmark,
  Pickaxe,
  Server,
  ShoppingBag,
  Sparkles,
  Sword,
  Timer,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";

import {
  CHARGE_REGEN_MS,
  CHESTS,
  CHEST_KEYS,
  PURCHASABLE_CHEST_KEYS,
  CHEST_LADDERS,
  DECAY_FLOOR,
  DECAY_GRACE_DAYS,
  MARKET_FEE_BPS,
  MAX_CLAIM_CHARGES,
  MAX_RAID_CHARGES,
  RARITY_KEYS,
  RARITY_META,
  SLOT_KEYS,
  SLOT_META,
  STAT_KEYS,
  STAT_META,
  VAULT_BASE_CAPACITY,
  HASHRATE_SOFTCAP,
  HASHRATE_SOFTCAP_RATE,
} from "@/features/constants/game";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "mining", label: "Mining & vault" },
  { id: "staking", label: "Staking" },
  { id: "stats", label: "Stats" },
  { id: "gear", label: "Gear & rarity" },
  { id: "upgrades", label: "Gear upgrades" },
  { id: "chests", label: "Chests & odds" },
  { id: "raiding", label: "Raiding" },
  { id: "market", label: "Marketplace" },
  { id: "wallet", label: "Deposits & withdrawals" },
  { id: "notoriety", label: "Notoriety" },
  { id: "leveling", label: "Leveling" },
  { id: "cosmetics", label: "Cosmetics & referrals" },
];

function ladderOdds(chest: (typeof CHEST_KEYS)[number]) {
  const ladder = CHEST_LADDERS[chest];
  let prev = 0;
  return ladder.map((step) => {
    const max = Number.isFinite(step.max) ? step.max : 100_000;
    const pct = ((max - prev) / 100_000) * 100;
    prev = max;
    return { rarity: step.rarity, pct };
  });
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold md:text-xl">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function WikiPage() {
  const regenHours = Math.round(CHARGE_REGEN_MS / 3_600_000);

  return (
    <div className="space-y-10 pb-16 pt-4">
      <header className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 md:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Documentation
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-4xl">CryptoCore Wiki</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Everything about the $HASH economy: how mining rates are calculated, what each stat does,
          staking, gear upgrades, chest drop odds, raid mechanics, on-chain deposits/withdrawals,
          and marketplace fees.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </div>
      </header>

      <Section id="getting-started" icon={Wallet} title="Getting started">
        <p>
          Connect a Solana wallet or start in demo mode, claim a miner tag, and your rig begins
          producing $HASH immediately. Progress is tied to your wallet address once connected.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Connect a wallet (or play demo mode locally).</li>
          <li>Pick a username — this is what rivals see on raid targets and market listings.</li>
          <li>Claim vault output, spend $HASH on stat upgrades, then open chests for gear.</li>
        </ol>
      </Section>

      <Section id="mining" icon={Pickaxe} title="Mining & vault">
        <p>
          Your rig mines continuously. Output accrues into your vault as raw $HASH until you claim
          it — once the vault is full, production is wasted, so claim regularly.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Mining rate: (effective Hash Rate + 1)² ÷ 48 hours, so a fresh rig always earns just
            enough to afford its next upgrade in about two days.
          </li>
          <li>
            Vault capacity: <strong className="text-foreground">{VAULT_BASE_CAPACITY} HASH</strong>{" "}
            base, plus +1 capacity for every 1 HASH you have staked into the vault (see{" "}
            <a href="#staking" className="text-primary underline-offset-2 hover:underline">
              Staking
            </a>
            ) — vault level does not affect capacity.
          </li>
          <li>
            Hash Rate above <strong className="text-foreground">{HASHRATE_SOFTCAP}</strong> is
            softcapped and counts for {HASHRATE_SOFTCAP_RATE * 100}% per point, so stacking
            gear/upgrades past that point has diminishing returns.
          </li>
          <li>
            Idle decay: full mining rate for {DECAY_GRACE_DAYS} days after your last HASH sink (an
            upgrade, chest purchase, item upgrade, stake or Notoriety burn), then -10% per week down
            to a {DECAY_FLOOR * 100}% floor. Claiming your vault does not count as a sink and will
            not reset the decay clock.
          </li>
          <li>
            Claiming costs a charge. You hold up to {MAX_CLAIM_CHARGES} claim charges and one
            regenerates every {regenHours} hours.
          </li>
        </ul>
      </Section>

      <Section id="staking" icon={Landmark} title="Staking">
        <p>
          Staking locks $HASH into your vault permanently — it can&apos;t be withdrawn or spent
          again, but it strengthens your rig in three ways at once:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Vault capacity grows 1-for-1 with every HASH staked, so you can go longer between
            claims.
          </li>
          <li>
            Luck rises on a milestone table (e.g. 1,000 staked ≈ +5% Luck), nudging chest rolls
            toward rarer gear.
          </li>
          <li>
            Firewall rises on its own milestone table, raising your base chance to block an incoming
            raid outright.
          </li>
          <li>
            Staking counts as a HASH sink, so it also resets your idle decay clock and earns XP.
          </li>
        </ul>
        <p>Bonuses lock in at each threshold and never go down — staking more only ever helps.</p>
      </Section>

      <Section id="stats" icon={Server} title="Stats">
        <div className="grid gap-3 sm:grid-cols-2">
          {STAT_KEYS.map((key) => (
            <div key={key} className="rounded-xl border border-border bg-card/50 p-4">
              <p className="text-sm font-semibold text-foreground">{STAT_META[key].label}</p>
              <p className="mt-1 text-xs">{STAT_META[key].description}</p>
            </div>
          ))}
        </div>
        <p>
          Hash Rate, Hack Power and Security are the three upgradeable stats — spend $HASH to raise
          their level. Each level costs <strong className="text-foreground">level²</strong> HASH, so
          upgrading gets steadily more expensive. Luck and Firewall instead come entirely from{" "}
          <a href="#staking" className="text-primary underline-offset-2 hover:underline">
            staking
          </a>
          , and Exploit comes entirely from{" "}
          <a href="#notoriety" className="text-primary underline-offset-2 hover:underline">
            Notoriety
          </a>{" "}
          — none of those three can be leveled up directly.
        </p>
      </Section>

      <Section id="gear" icon={Boxes} title="Gear & rarity">
        <p>
          Your rig has six equipment slots. Each equipped item adds its rolled stats to your totals.
        </p>
        <div className="flex flex-wrap gap-2">
          {SLOT_KEYS.map((slot) => (
            <span
              key={slot}
              className="rounded-md border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {SLOT_META[slot].label}
            </span>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Rarity</th>
                <th className="px-3 py-2">Stat roll range</th>
              </tr>
            </thead>
            <tbody>
              {RARITY_KEYS.map((rarity) => (
                <tr key={rarity} className="border-t border-border/60">
                  <td className={cn("px-3 py-2 font-semibold", RARITY_META[rarity].textClass)}>
                    {RARITY_META[rarity].label}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {RARITY_META[rarity].min} – {RARITY_META[rarity].max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="upgrades" icon={Wrench} title="Gear upgrades">
        <p>
          Individual items can be leveled up independently of your account-wide stat upgrades. This
          is paid in <strong className="text-foreground">SPARKS</strong>, a separate currency from
          $HASH, and the cost rises steeply with the item&apos;s current level (roughly level
          <sup>1.8</sup> × 50 SPARKS for the next level).
        </p>
        <p>
          A leveled-up item&apos;s rolled stats scale up with it, so upgrading is a way to keep a
          favorite rare or legendary drop competitive instead of replacing it with a fresh roll.
        </p>
      </Section>

      <Section id="chests" icon={Boxes} title="Chests & odds">
        <p>
          Chests are bought with $HASH and roll a random slot, rarity and stat spread. Luck nudges
          the roll toward higher rarities.
        </p>
        <div className="space-y-3">
          {PURCHASABLE_CHEST_KEYS.map((chest) => (
            <div key={chest} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{CHESTS[chest].label}</p>
                <p className="font-mono text-xs text-primary">
                  {CHESTS[chest].price.toLocaleString()} HASH
                </p>
              </div>
              <p className="mt-1 text-xs">{CHESTS[chest].blurb}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ladderOdds(chest).map((step) => (
                  <span
                    key={step.rarity}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium",
                      RARITY_META[step.rarity].bgClass,
                      RARITY_META[step.rarity].textClass,
                    )}
                  >
                    {RARITY_META[step.rarity].label}{" "}
                    {step.pct % 1 === 0 ? step.pct : step.pct.toFixed(2)}%
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="raiding" icon={Sword} title="Raiding">
        <p>
          Raiding lets you steal unclaimed vault $HASH from a rival. Every raid resolves in two
          steps:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Eligibility:</strong> your Hack Power must exceed
            the target&apos;s Security, or the raid never starts and no charge is spent.
          </li>
          <li>
            <strong className="text-foreground">Firewall roll:</strong> if you clear that bar, the
            target&apos;s Firewall is a straight percent chance the raid gets blocked outright with
            nothing stolen.
          </li>
        </ol>
        <p>
          If it lands, the stolen share is a random roll between your Exploit stat and 100% of the
          target&apos;s vault — so Exploit only sets the floor, never the ceiling, of what you take.
          The target loses that full rolled amount regardless, but what you actually collect is
          capped by your own free vault space; if the roll is bigger than the room you have, the
          excess is destroyed instead of being credited to you or left behind with the target. A
          raid never touches any stat — Security, Firewall, and every other stat are unaffected by
          being raided.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Up to {MAX_RAID_CHARGES} raid charges, one regenerating every {regenHours} hours.
          </li>
          <li>
            Your maximum raid charges shrink the longer you go without a HASH sink (upgrade, chest,
            item upgrade, stake or burn) — staying active keeps your full charge pool.
          </li>
          <li>A rival cannot be raided again immediately — a short cooldown applies per target.</li>
          <li>Every raid is logged with its seed, so outcomes are verifiable.</li>
        </ul>
      </Section>

      <Section id="market" icon={ShoppingBag} title="Marketplace">
        <p>
          List spare gear or cosmetics and buy from other miners using the on-chain $HASH SPL token
          directly — not your in-game vault balance. The buyer sends payment straight to the
          seller&apos;s wallet on Solana, minus a{" "}
          <strong className="text-foreground">{MARKET_FEE_BPS / 100}%</strong> fee that goes to the
          treasury.
        </p>
        <p>
          Every purchase is settled by the same on-chain worker that handles deposits and
          withdrawals: it verifies the payment transaction, transfers the item to the buyer, and
          pays the seller their cut. A payment transaction can only ever be used once, so a listing
          can&apos;t be double-sold.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/marketplace">Open marketplace</Link>
        </Button>
      </Section>

      <Section id="wallet" icon={ArrowLeftRight} title="Deposits & withdrawals">
        <p>
          $HASH is a real Solana SPL token. Your in-game vault balance and your on-chain wallet
          balance are separate — you move between them explicitly:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Deposit:</strong> send $HASH tokens to the treasury,
            then submit that transaction signature in-app. A background worker verifies the payment
            on-chain before crediting your in-game balance — nothing is credited on the client side
            alone.
          </li>
          <li>
            <strong className="text-foreground">Withdraw:</strong> gated by Notoriety. With zero
            Notoriety you cannot withdraw at all. Your daily withdrawal ceiling equals your current
            Notoriety score (1:1), and it resets 24 hours after your first withdrawal of the window.
          </li>
          <li>
            Withdrawals debit your in-game balance immediately; the on-chain payout is refunded if
            it fails.
          </li>
        </ul>
      </Section>

      <Section id="notoriety" icon={Flame} title="Notoriety">
        <p>
          Burning $HASH permanently spends it and converts it into Notoriety at a fixed 1:1 rate —
          100% of the burned amount becomes Notoriety. There is no separate direct stat grant on top
          of that.
        </p>
        <p>
          Notoriety itself is what drives your Exploit stat: your cumulative Notoriety is checked
          against a fixed bonus table, and each threshold you clear locks in a higher Exploit bonus
          — the more Notoriety you&apos;ve burned into, the higher your Exploit ceiling. Firewall is
          unaffected by burns; it instead scales with how much $HASH you have staked in your vault
          (see{" "}
          <a href="#staking" className="text-primary underline-offset-2 hover:underline">
            Staking
          </a>
          ).
        </p>
        <p>
          Notoriety is also your withdrawal key (see{" "}
          <a href="#wallet" className="text-primary underline-offset-2 hover:underline">
            Deposits & withdrawals
          </a>
          ) and ranks you against other miners on the leaderboard.
        </p>
        <p className="flex items-center gap-2 text-xs">
          <Timer className="size-3.5 text-primary" />
          This is an in-game sink, not an on-chain token burn — no tokens are destroyed on the
          blockchain. The committed $HASH is removed from your balance and cannot be recovered.
        </p>
      </Section>

      <Section id="leveling" icon={TrendingUp} title="Leveling">
        <p>
          Your account level is driven entirely by XP, which is purely cosmetic progress — it
          doesn&apos;t change any stat or rate directly, but it does track how much you&apos;ve
          invested in your rig.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Stat upgrades (Hash Rate, Hack Power, Security) earn 10 XP per HASH spent.</li>
          <li>
            Item upgrades and salvages earn 100 XP per SPARK of value gained or paid out — not a
            flat rate, since it scales with the rarity and level of the gear involved.
          </li>
          <li>Winning a raid earns a flat 100 XP.</li>
          <li>
            Opening chests, staking $HASH into your vault, and burning $HASH for Notoriety are all
            still worthwhile sinks for their own rewards, but none of them grant XP directly.
          </li>
          <li>Level is derived from cumulative XP; each level requires more XP than the last.</li>
        </ul>
      </Section>

      <Section id="cosmetics" icon={Sparkles} title="Cosmetics & referrals">
        <p>
          Avatars, banners and backgrounds are separate collectible items purchased with $HASH from
          the cosmetics shop. Most templates have a limited supply — once every edition mints, that
          cosmetic is sold out for good.
        </p>
        <p className="flex items-center gap-2">
          <Gem className="size-3.5 text-primary" />
          Every player starts with a default soulbound avatar, banner and background, so you always
          have something equipped even before buying anything.
        </p>
        <p>
          If you were referred by another player, 5% of every chest you buy is paid straight to your
          referrer&apos;s in-game balance — on top of the price you pay, not deducted from it.
        </p>
      </Section>
    </div>
  );
}
