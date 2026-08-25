// src/lib/modules/login-nonces/model.server.ts
import mongoose, { Schema, Model } from "mongoose";
import type { ILoginNonce } from "./types.server";

const LoginNonceSchema = new Schema<ILoginNonce>(
  {
    wallet: { type: String, required: true, unique: true, index: true },
    nonce: { type: String, required: true },
    issuedAt: { type: Number, required: true },
    expiresAt: { type: Number, required: true },
    used: { type: Boolean, default: false },
    signature: { type: String, default: "" },
  },
  { collection: "login-nonces" },
);

LoginNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginNonceModel: Model<ILoginNonce> =
  mongoose.models["LoginNonce"] ?? mongoose.model<ILoginNonce>("LoginNonce", LoginNonceSchema);
