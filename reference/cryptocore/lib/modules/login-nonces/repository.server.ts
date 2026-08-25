// src/lib/modules/login-nonces/repository.server.ts
import { randomBytes } from "crypto";
import { LoginNonceModel } from "./model.server";
import type { ILoginNonce } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

const CHALLENGE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function createNonce(wallet: string): Promise<ILoginNonce> {
  await connectDatabase();
  const nonce = randomBytes(32).toString("hex");
  const now = Date.now();
  return LoginNonceModel.findOneAndUpdate(
    { wallet },
    {
      $set: {
        wallet,
        nonce,
        issuedAt: now,
        expiresAt: now + CHALLENGE_TTL_MS,
        used: false,
        signature: "",
      },
    },
    { upsert: true, new: true },
  ).then((d) => d!);
}

export async function findNonce(wallet: string): Promise<ILoginNonce | null> {
  await connectDatabase();
  return LoginNonceModel.findOne({ wallet }).lean<ILoginNonce>();
}

export async function markNonceUsed(wallet: string, signature: string): Promise<void> {
  await connectDatabase();
  await LoginNonceModel.updateOne({ wallet }, { $set: { used: true, signature } });
}
