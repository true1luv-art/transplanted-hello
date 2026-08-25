import mongoose, { Schema, type Model } from "mongoose";
import { newId, nowIso } from "@/lib/config/helpers";
import { hiveAvatarUrl, hiveCoverUrl, normalizeHiveUsername } from "@/lib/chain/identity";
import type { CreateUserInput, UserDocument, UserView } from "./types.server";

/**
 * Users module — Mongoose model + pure factories.
 *
 * The `users` collection stores ONLY app-owned state keyed by the Hive
 * username (the actor identity). Anything the Hive chain owns — display name,
 * avatar, cover, on-chain HIVE balance — is read from the chain at request
 * time, never persisted here.
 *
 * SERVER-ONLY.
 */

export const USERS_COLLECTION = "users";

const UserSchema = new Schema<UserDocument>(
  {
    id: { type: String, required: true },
    username: { type: String, required: true },
    ledgerBalance: { type: Number, required: true, default: 0 },
    role: { type: String, required: true, enum: ["user", "creator"], default: "user" },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: USERS_COLLECTION, _id: false, versionKey: false, minimize: false },
);

UserSchema.index({ id: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });

export const UserModel: Model<UserDocument> =
  (mongoose.models["User"] as Model<UserDocument> | undefined) ??
  mongoose.model<UserDocument>("User", UserSchema);

/** Builds a users document from a Hive account name. */
export function createUserDocument(input: CreateUserInput): UserDocument {
  const timestamp = nowIso();
  return {
    id: newId("usr"),
    username: normalizeHiveUsername(input.username),
    ledgerBalance: input.ledgerBalance ?? 0,
    role: input.role ?? "user",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Read model. Display name and images are derived from the Hive username on
 * every read; the authoritative values live in the account's chain metadata
 * and are fetched separately via `getHiveAccountSnapshot`.
 */
export function toUserView(user: UserDocument): UserView {
  return {
    ...user,
    displayName: user.username,
    avatarUrl: hiveAvatarUrl(user.username),
    bannerUrl: hiveCoverUrl(user.username),
  };
}
