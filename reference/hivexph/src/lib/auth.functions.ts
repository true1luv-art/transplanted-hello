/**
 * lib/auth.functions.ts
 *
 * Server functions for Hive Keychain–based auth. The client signs a
 * challenge in-browser with Keychain (proving control of the @username's
 * Posting key) and posts {username, signature, message} here. We trust the
 * client to have actually performed the signing (matching the original
 * HiveX PH reference behavior) and store the username in an encrypted
 * httpOnly session cookie so server-side reads can identify the user
 * without a DB lookup.
 *
 * NOTE on signature verification: a full server-side secp256k1 verify
 * against the on-chain account key requires a Workers-compatible Hive RPC
 * client + crypto. Deferred — see `docs/convert-phases.md` Phase 6 notes.
 */

import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import type { AppUser } from "@/lib/session-shared";

const SessionSchema = z.object({
  username: z.string().min(3).max(16).regex(/^[a-z0-9.\-]+$/),
});

type SessionData = z.infer<typeof SessionSchema>;

function getSessionConfig() {
  const password =
    process.env.SESSION_SECRET ??
    "hivep2p-dev-session-secret-please-set-SESSION_SECRET-in-production-32+";
  return {
    password,
    name: "hivep2p_session",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: true,
      path: "/",
    },
  };
}

const LoginInputSchema = z.object({
  username: z.string().min(3).max(16),
  signature: z.string().min(1),
  message: z.string().min(1),
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginInputSchema.parse(input))
  .handler(async ({ data }) => {
    const username = data.username.trim().replace(/^@/, "").toLowerCase();
    const parsed = SessionSchema.safeParse({ username });
    if (!parsed.success) {
      throw new Error("Invalid Hive username.");
    }
    const session = await useSession<SessionData>(getSessionConfig());
    await session.update({ username: parsed.data.username });
    return { ok: true as const, username: parsed.data.username };
  });

export const switchAccountFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SessionSchema.parse(input))
  .handler(async ({ data }) => {
    const username = data.username.trim().replace(/^@/, "").toLowerCase();
    const parsed = SessionSchema.safeParse({ username });
    if (!parsed.success) {
      throw new Error("Invalid Hive username.");
    }
    const session = await useSession<SessionData>(getSessionConfig());
    await session.update({ username: parsed.data.username });
    return { ok: true as const, username: parsed.data.username };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<SessionData>(getSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppUser | null> => {
    const session = await useSession<SessionData>(getSessionConfig());
    const username = session.data?.username?.trim();
    if (!username) return null;
    return {
      username,
      fullName: "",
      avatarInitials: username.slice(0, 2).toUpperCase(),
      isLoggedIn: true,
    };
  },
);
