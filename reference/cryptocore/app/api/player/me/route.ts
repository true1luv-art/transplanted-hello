import { authenticateRequest, type AuthContext } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import {
  findPlayerByWallet,
  findPlayerByUsername,
  upsertPlayer,
  updatePlayer,
  incrementPlayer,
} from "@/lib/modules/players/repository.server";
import { incrementStat } from "@/lib/modules/game-stats/repository.server";
import { mintSoulboundDefaults } from "@/lib/modules/assets/mint-defaults.server";
import { findAssetsByIds, findAssetsByOwner } from "@/lib/modules/assets/repository.server";
import { decayMultiplier, effectiveHashRate, miningPerSecond } from "@/features/game/mining";
import { tickPlayer, tickPatch } from "@/lib/game/mining.server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Resolves the player's stored cosmetic ObjectId refs into numeric template IDs
 * that the client can render directly. Returns null when nothing is equipped.
 */
async function resolveProfile(player: NonNullable<Awaited<ReturnType<typeof findPlayerByWallet>>>) {
  const refs = player.profile;
  if (!refs) return null;

  const entries = [
    ["avatar", refs.avatar] as const,
    ["banner", refs.banner] as const,
    ["background", refs.background] as const,
  ];
  const ids = entries.map(([, id]) => id).filter((id): id is NonNullable<typeof id> => id != null);
  const assets = await findAssetsByIds(ids);
  const templateById = new Map(assets.map((a) => [String(a._id), a.templateId]));

  return {
    avatar: refs.avatar ? (templateById.get(String(refs.avatar)) ?? null) : null,
    banner: refs.banner ? (templateById.get(String(refs.banner)) ?? null) : null,
    background: refs.background ? (templateById.get(String(refs.background)) ?? null) : null,
  };
}

async function toPlayerDto(player: NonNullable<Awaited<ReturnType<typeof findPlayerByWallet>>>) {
  const profile = await resolveProfile(player);
  return {
    profile,
    address: player.wallet,
    username: player.username,
    registrationTime: player.registrationTime,
    xp: player.xp,
    level: player.level,
    hash: player.hash,
    sparks: player.sparks,
    vault: player.vault,
    vaultStaked: player.vaultStaked,
    notoriety: player.notoriety,
    totalBurned: player.totalBurned,
    statLevels: player.statLevels,
    stats: player.stats,
    // Derived, not stored: HASH/sec is always a pure function of the current
    // effective hash rate (stats.hashRate) + idle decay, so it's computed
    // fresh here rather than persisted as a separate DB field that could
    // drift out of sync with the stats it's derived from.
    minerate: miningPerSecond(
      effectiveHashRate(player.stats.hashRate),
      decayMultiplier(player.lastSinkAt),
    ),
    lastTickAt: player.lastTickAt,
    lastSinkAt: player.lastSinkAt,
    claimCharges: player.claimCharges,
    lastClaimRegenAt: player.lastClaimRegenAt,
    raidCharges: player.raidCharges,
    lastRaidRegenAt: player.lastRaidRegenAt,
    lastUpgradeTime: player.lastUpgradeTime,
    raidCooldown: player.raidCooldown,
    milestones: {
      totalClaimed: player.milestones?.totalClaimed ?? 0,
      totalMined: player.milestones?.totalMined ?? 0,
      raids: player.milestones?.raids ?? 0,
      raidWins: player.milestones?.raidWins ?? 0,
      totalStolen: player.milestones?.totalStolen ?? 0,
      bestHashRate: player.milestones?.bestHashRate ?? 1,
    },
    protectionUntil: player.protectionUntil,
    version: player.version,
    referredBy: player.referredBy ?? null,
    referralCount: player.referralCount ?? 0,
    referralEarned: player.referralEarned ?? 0,
    withdrawnToday: player.withdrawnToday ?? 0,
    withdrawResetAt: player.withdrawResetAt ?? 0,
  };
}

const updateInput = z.object({ username: z.string().min(3).max(32) });

async function handleGet(request: Request, auth: AuthContext) {
  let player = await findPlayerByWallet(auth.wallet);
  if (!player) {
    await upsertPlayer({ wallet: auth.wallet, username: auth.wallet });
    // New player created — increment global count and mint soulbound cosmetics.
    // mintSoulboundDefaults is awaited (not fire-and-forget): once this
    // handler returns its response, the serverless invocation can be frozen
    // or torn down at any point, so an un-awaited promise here has no
    // guarantee of ever finishing — that's why brand-new accounts were
    // ending up with profile.avatar/banner/background stuck at null.
    void incrementStat("registeredPlayers");
    await mintSoulboundDefaults(auth.wallet);

    // Wire referral if ?ref=<username> was provided and the referrer exists.
    const refUsername = new URL(request.url).searchParams.get("ref");
    if (refUsername) {
      const referrer = await findPlayerByUsername(refUsername);
      if (referrer && referrer.wallet !== auth.wallet) {
        await Promise.all([
          updatePlayer(auth.wallet, { referredBy: referrer.wallet }),
          incrementPlayer(referrer.wallet, { referralCount: 1 }),
        ]);
      }
    }

    player = await findPlayerByWallet(auth.wallet);
  }
  if (!player) {
    return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
  }

  // Self-heal accounts created before the fix above: if the player owns no
  // assets at all, they never got their soulbound defaults, regardless of
  // whether that was because of the pre-existing fire-and-forget bug. Safe
  // to retry — mintSoulboundDefaults is idempotent per-call, and this only
  // fires when the player's asset collection is genuinely empty.
  if (!player.profile?.avatar && !player.profile?.banner && !player.profile?.background) {
    const existingAssets = await findAssetsByOwner(auth.wallet);
    if (existingAssets.length === 0) {
      await mintSoulboundDefaults(auth.wallet);
      player = await findPlayerByWallet(auth.wallet);
      if (!player) {
        return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
      }
    }
  }

  // Every GET is also the mining tick: recompute vault growth for the time
  // elapsed since `lastTickAt` and persist it immediately, so the response
  // (and the DB row it came from) always reflects the real, authoritative
  // vault — not whatever was last written by a claim/upgrade. The client
  // polls this endpoint every ~10s specifically to keep the on-screen vault
  // honest against the DB instead of drifting from local-only simulation.
  const { player: ticked } = tickPlayer(player);
  // Scoped $set (never the whole document) — see tickPatch for why: this
  // route runs on every dashboard poll, so a full-document write here would
  // routinely stomp a concurrent stake/burn/upgrade's atomic $inc back to
  // its stale pre-update value.
  await updatePlayer(auth.wallet, { $set: tickPatch(ticked) });

  return jsonResponse({ ok: true, player: await toPlayerDto(ticked) }, request);
}

async function handlePost(request: Request, auth: AuthContext) {
  try {
    const body = await request.json();
    const { username } = updateInput.parse(body);
    await upsertPlayer({ wallet: auth.wallet, username });
    await updatePlayer(auth.wallet, { username });
    const player = await findPlayerByWallet(auth.wallet);
    if (!player) {
      return jsonResponse({ ok: false, error: "Player not found" }, request, { status: 404 });
    }
    return jsonResponse({ ok: true, player: await toPlayerDto(player) }, request);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonResponse({ ok: false, error: "Invalid request", issues: err.issues }, request, {
        status: 400,
      });
    }
    throw err;
  }
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return await handleGet(request, auth);
  } catch (err) {
    console.error("[player/me GET]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;
  try {
    return await handlePost(request, auth);
  } catch (err) {
    console.error("[player/me POST]", err);
    return jsonResponse({ ok: false, error: "Internal server error" }, request, { status: 500 });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: { "Access-Control-Allow-Methods": "GET, POST, OPTIONS" },
  });
}
