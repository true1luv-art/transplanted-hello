// src/lib/modules/players/repository.server.ts
import { PlayerModel } from "./model.server";
import type { IPlayer } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

export async function upsertPlayer(input: { wallet: string; username: string }) {
  await connectDatabase();
  return PlayerModel.findOneAndUpdate(
    { wallet: input.wallet },
    {
      $setOnInsert: {
        wallet: input.wallet,
        username: input.username,
        registrationTime: Date.now(),
      },
    },
    { upsert: true, new: true },
  );
}

export async function findPlayerByWallet(wallet: string) {
  await connectDatabase();
  return PlayerModel.findOne({ wallet }).lean<IPlayer>();
}

export async function findPlayerByUsername(username: string) {
  await connectDatabase();
  return PlayerModel.findOne({ username }).lean<IPlayer>();
}

export async function findPlayer(identifier: string) {
  await connectDatabase();
  return (
    (await PlayerModel.findOne({ username: identifier }).lean<IPlayer>()) ??
    (await PlayerModel.findOne({ wallet: identifier }).lean<IPlayer>())
  );
}

export async function creditHash(wallet: string, amount: number): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne({ wallet }, { $inc: { hash: amount } });
}

export async function debitHash(wallet: string, amount: number): Promise<{ ok: boolean }> {
  await connectDatabase();
  const result = await PlayerModel.updateOne(
    { wallet, hash: { $gte: amount } },
    { $inc: { hash: -amount } },
  );
  return { ok: result.modifiedCount > 0 };
}

export async function creditSparks(wallet: string, amount: number): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne({ wallet }, { $inc: { sparks: amount } });
}

export async function debitSparks(wallet: string, amount: number): Promise<{ ok: boolean }> {
  await connectDatabase();
  const result = await PlayerModel.updateOne(
    { wallet, sparks: { $gte: amount } },
    { $inc: { sparks: -amount } },
  );
  return { ok: result.modifiedCount > 0 };
}

export async function updatePlayer(
  wallet: string,
  update: Partial<IPlayer> | Record<string, unknown>,
) {
  await connectDatabase();
  const raw = update as Record<string, unknown>;
  const usesOperators = Object.keys(raw).some((key) => key.startsWith("$"));

  if (usesOperators) {
    // Caller passed a Mongo update document ({ $inc, $set, ... }) — pass through.
    return PlayerModel.updateOne({ wallet }, raw);
  }

  // Plain object: strip immutable/internal fields so passing a whole lean
  // document (e.g. from findPlayerByWallet) doesn't fail on _id.
  const {
    _id: _ignoredId,
    __v: _ignoredV,
    wallet: _ignoredWallet,
    createdAt: _ignoredCreatedAt,
    updatedAt: _ignoredUpdatedAt,
    ...safe
  } = raw;

  return PlayerModel.updateOne({ wallet }, { $set: safe });
}

export async function incrementPlayer(wallet: string, inc: Record<string, number>) {
  await connectDatabase();
  return PlayerModel.updateOne({ wallet }, { $inc: inc });
}

/**
 * Atomically checks the player's daily withdrawal cap (== their notoriety)
 * against `withdrawnToday` (auto-resetting the 24-hour window if it has
 * elapsed) and, only if `amount` still fits under the cap, records it —
 * all as a single findOneAndUpdate. The filter's `$expr` re-derives the
 * effective withdrawnToday/cap from the document's OWN current fields at
 * match time and the pipeline update recomputes the exact same values to
 * write, so the "is there room left?" check and the "record this
 * withdrawal" write happen atomically with no gap a concurrent request
 * could land in. The previous implementation read `withdrawnToday` into
 * application code, compared it there, then wrote back a separately
 * computed value — two parallel withdrawal requests could both read the
 * same starting `withdrawnToday`, both pass the check, and both get
 * queued, together exceeding the daily cap even though neither one alone
 * did.
 */
export async function reserveWithdrawalCap(
  wallet: string,
  amount: number,
  now: number,
  windowMs: number,
): Promise<{ ok: boolean }> {
  await connectDatabase();

  const effectiveWithdrawnToday = {
    $cond: [{ $lte: ["$withdrawResetAt", now] }, 0, { $ifNull: ["$withdrawnToday", 0] }],
  };

  const result = await PlayerModel.findOneAndUpdate(
    {
      wallet,
      $expr: {
        $lte: [{ $add: [effectiveWithdrawnToday, amount] }, { $ifNull: ["$notoriety", 0] }],
      },
    },
    [
      {
        $set: {
          withdrawnToday: { $add: [effectiveWithdrawnToday, amount] },
          withdrawResetAt: {
            $cond: [{ $lte: ["$withdrawResetAt", now] }, now + windowMs, "$withdrawResetAt"],
          },
        },
      },
    ],
    // Mongoose 9 requires `updatePipeline: true` to be passed explicitly
    // whenever the update argument is an aggregation pipeline (an array)
    // rather than a plain update document — otherwise it throws instead
    // of running the pipeline.
    { new: true, updatePipeline: true },
  ).lean<IPlayer>();

  return { ok: Boolean(result) };
}

/**
 * Compensating rollback for reserveWithdrawalCap — used when a downstream
 * step (e.g. the HASH debit) fails after the cap was already reserved.
 * Guarded so it can never take withdrawnToday below 0.
 */
export async function releaseWithdrawalCap(wallet: string, amount: number): Promise<void> {
  await connectDatabase();
  await PlayerModel.updateOne(
    { wallet, withdrawnToday: { $gte: amount } },
    { $inc: { withdrawnToday: -amount } },
  );
}

/**
 * Atomically regenerates raidCharges up to `now`, then reserves (consumes)
 * exactly one charge if available. This MUST be the only place raidCharges
 * is decremented. Doing the "does the player have a charge?" check and the
 * decrement as two separate steps (e.g. reading the player doc, checking
 * `raidCharges > 0` in application code, then writing back a computed
 * value) lets two concurrent requests from the same wallet both read the
 * same starting count and both pass the check, spending more charges than
 * the player actually had. Regen is applied via an aggregation-pipeline
 * update so it is derived from the document's own current fields at write
 * time rather than a value read moments earlier.
 */
export async function reserveRaidCharge(
  wallet: string,
  now: number,
  regenMs: number,
  maxCharges: number,
): Promise<{ ok: boolean; raidCharges?: number }> {
  await connectDatabase();

  // See the `updatePipeline: true` note in reserveWithdrawalCap above — same
  // Mongoose 9 requirement applies here since this update is also an
  // aggregation pipeline (an array), not a plain update document.
  await PlayerModel.updateOne(
    { wallet },
    [
      {
        $set: {
          raidCharges: {
            $min: [
              maxCharges,
              {
                $add: [
                  "$raidCharges",
                  { $floor: { $divide: [{ $subtract: [now, "$lastRaidRegenAt"] }, regenMs] } },
                ],
              },
            ],
          },
          lastRaidRegenAt: {
            $cond: [
              { $gte: [{ $subtract: [now, "$lastRaidRegenAt"] }, regenMs] },
              now,
              "$lastRaidRegenAt",
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );

  // Guarded decrement — identical pattern to debitHash/debitSparks above —
  // only succeeds if raidCharges is still >= 1 at write time.
  const result = await PlayerModel.findOneAndUpdate(
    { wallet, raidCharges: { $gte: 1 } },
    { $inc: { raidCharges: -1 } },
    { new: true },
  ).lean<IPlayer>();

  if (!result) return { ok: false };
  return { ok: true, raidCharges: result.raidCharges };
}

/**
 * Returns up to 100 players whose effective security stat is strictly below
 * `attackerHackPower`, excluding the attacker themselves, sorted by vault
 * descending (highest vault first — richest targets at the top).
 */
export async function findRaidTargets(
  attackerHackPower: number,
  excludeWallet: string,
): Promise<IPlayer[]> {
  await connectDatabase();
  return PlayerModel.find({
    wallet: { $ne: excludeWallet },
    "stats.security": { $lt: attackerHackPower },
  })
    .sort({ vault: -1 })
    .limit(100)
    .lean<IPlayer[]>();
}
