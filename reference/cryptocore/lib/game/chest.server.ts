// src/lib/game/chest.server.ts
import { CHEST_LADDERS, RARITY_INDEX, CHESTS, STAT_KEYS } from "@/features/constants/game";
import { randomItemName } from "@/features/game/item-names";
import type { ChestKey, Rarity, SlotKey, StatKey } from "@/features/types/game";
import { insertItem, mintNextItemNumber } from "@/lib/modules/items/repository.server";
import { createLog } from "@/lib/modules/logs/repository.server";
import { creditHash, debitHash, incrementPlayer } from "@/lib/modules/players/repository.server";
import { getTemplateIdForSlotRarity } from "@/features/templates/equipments";
import { incrementMintCount } from "@/lib/modules/templates/repository.server";
import { createSeededRng, generateServerSeed } from "./rng";

const REFERRAL_CUT = 0.05; // 5% of chest price goes to referrer

const SLOT_ORDER: SlotKey[] = [
  "asicMiner",
  "motherboard",
  "powerSupply",
  "coolingSystem",
  "networkModule",
  "firmwareChip",
];

// Each sub-roll gets its own namespaced seed. Reusing the SAME seed string
// for rarity/slot/stats (the previous behaviour) means createSeededRng
// re-derives an identical initial state each time, so the first draw from
// every sub-roll is numerically the same value — entangling rarity, slot,
// and stats instead of rolling them independently like the reference does
// off one continuously-advancing rng.
export function rollRarity(chest: ChestKey, luck: number, seed: string): Rarity {
  const rng = createSeededRng(`${seed}:rarity`);
  const roll = rng() * 100_000 + Math.min(luck * 100, 5_000);
  const ladder = CHEST_LADDERS[chest];
  for (const step of ladder) {
    const max = Number.isFinite(step!.max) ? step!.max : 100_000;
    if (roll <= max) return step!.rarity;
  }
  return ladder[ladder.length - 1]!.rarity;
}

export function pickRandomSlot(seed: string): SlotKey {
  const rng = createSeededRng(`${seed}:slot`);
  return SLOT_ORDER[Math.floor(rng() * SLOT_ORDER.length)]!;
}

/** Combat-scale stats are stored on a x10 scale, exactly like the reference. */
const SCALED_STATS: StatKey[] = ["hackPower", "security"];

/** Slots that always guarantee their signature stat as the first roll. */
const SLOT_SIGNATURE_STAT: Partial<Record<SlotKey, StatKey>> = {
  asicMiner: "hashRate",
  networkModule: "hackPower",
  coolingSystem: "security",
};

/**
 * Rarity index used for BOTH the stat count and the stat value scale.
 * Reference (`rollItemAttributes`): epic rolls ONE 50/50 between index 4
 * and 5, and that same roll drives how many attributes land AND how strong
 * they roll — count is never chosen independently from magnitude, unlike
 * the previous implementation here which rolled `count` and the value
 * scale from two unrelated sources.
 */
function rollRarityIndex(rarity: Rarity, rng: () => number): number {
  if (rarity === "epic") return rng() < 0.5 ? 4 : 5;
  return RARITY_INDEX[rarity];
}

/**
 * Value formula from the reference game (`rollItemAttributes`): a roll
 * inside [0.1 x rarityIndex, rarityIndex], with combat stats scaled x10 —
 * NOT the old "1-4 + rarityIndex, plus 0-2 variance" formula, which rolled
 * values several times too generous (e.g. a common item could roll as high
 * as 6 on every stat instead of topping out at 1).
 */
export function rollStats(rarity: Rarity, seed: string, slot?: SlotKey): Record<StatKey, number> {
  const rng = createSeededRng(`${seed}:stats`);
  const index = rollRarityIndex(rarity, rng);
  const count = Math.min(STAT_KEYS.length, index);
  const signature = slot ? SLOT_SIGNATURE_STAT[slot] : undefined;

  const rolled: Record<StatKey, number> = {
    hashRate: 0,
    hackPower: 0,
    security: 0,
    luck: 0,
    firewall: 0,
    exploit: 0,
  };

  const availableKeys = STAT_KEYS.filter((key) => key !== signature);
  const keys: StatKey[] = signature ? [signature] : [];
  for (let i = keys.length; i < count && availableKeys.length > 0; i++) {
    const idx = Math.floor(rng() * availableKeys.length);
    const key = availableKeys.splice(idx, 1)[0];
    if (key) keys.push(key);
  }

  const floor = 0.1 * index;
  for (const key of keys) {
    const roll = rng() * (index - floor) + floor;
    const value = SCALED_STATS.includes(key) ? roll * 10 : roll;
    rolled[key] = Math.round(value * 10) / 10;
  }

  return rolled;
}

export async function openChest(
  wallet: string,
  chest: ChestKey,
  clientSeed: string,
): Promise<{ ok: boolean; item?: Record<string, unknown>; error?: string }> {
  const price = CHESTS[chest].price;
  const { ok } = await debitHash(wallet, price);
  if (!ok) return { ok: false, error: "Not enough HASH" };

  const { findPlayerByWallet } = await import("@/lib/modules/players/repository.server");
  const player = await findPlayerByWallet(wallet);
  if (!player) return { ok: false, error: "Player not found" };

  // Mix in a server-generated seed the client never sees before the debit
  // above lands. createSeededRng() is a public, reproducible algorithm, so
  // a client-only seed can be brute-forced offline until it yields a
  // guaranteed legendary/max-stat roll. The client seed still contributes
  // (kept for auditability in the log below) but no longer controls the
  // outcome on its own.
  const serverSeed = generateServerSeed();
  const seed = `${clientSeed}:${serverSeed}`;

  const rarity = rollRarity(chest, player.statLevels.luck, seed);
  const slot = pickRandomSlot(seed);
  const stats = rollStats(rarity, seed, slot);
  const templateId = getTemplateIdForSlotRarity(slot, rarity);

  // The item template must exist in the DB (seeded via seed-templates.ts)
  // before we can mint against it. If it's missing — e.g. a fresh/dev DB
  // that hasn't been seeded yet, or a rarity tier not yet released — refund
  // the chest price and surface a clear "not available yet" error instead
  // of silently minting an item with no backing template/edition counter.
  const mintResult = await incrementMintCount(templateId);
  if (!mintResult.ok) {
    await creditHash(wallet, price); // refund the debit above
    return {
      ok: false,
      error: `This item is not available yet (template ${templateId} not found). Your HASH has been refunded.`,
    };
  }

  const itemNumber = await mintNextItemNumber();

  const item = await insertItem({
    itemNumber,
    templateId,
    mintNumber: mintResult.mintNumber,
    owner: wallet,
    name: randomItemName(slot, seed),
    slot,
    rarity,
    level: 1,
    stats,
    equipped: false,
    salvaged: false,
    createdAt: Date.now(),
    lastTransfer: 0,
  });

  await createLog({
    type: "chest",
    wallet,
    amount: -price,
    seed: clientSeed,
    data: {
      chest,
      rarity,
      slot,
      itemNumber,
      name: item.name,
      serverSeed, // recorded post-hoc for provable-fairness audits
    },
  });

  // Fire referral cut if this player was referred by someone.
  if (player.referredBy) {
    const cut = Math.floor(price * REFERRAL_CUT);
    if (cut > 0) {
      await Promise.all([
        creditHash(player.referredBy, cut),
        incrementPlayer(player.referredBy, { referralEarned: cut }),
        createLog({
          type: "referral",
          wallet: player.referredBy,
          target: wallet,
          amount: cut,
          data: { chest, chestPrice: price },
        }),
      ]);
    }
  }

  return { ok: true, item: item.toObject() };
}
