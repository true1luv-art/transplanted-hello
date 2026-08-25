// src/lib/modules/login-nonces/types.server.ts
import type { Document } from "mongoose";

export interface ILoginNonce extends Document {
  wallet: string; // primary key
  nonce: string; // random challenge
  issuedAt: number; // Unix ms
  expiresAt: number; // Unix ms
  used: boolean; // consumed once
  signature: string; // base58 signature submitted
}
