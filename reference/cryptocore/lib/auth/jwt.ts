// src/lib/auth/jwt.ts
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "@/lib/config/config";

export interface SessionPayload extends JWTPayload {
  wallet: string;
  username: string;
}

const secret = new TextEncoder().encode(config.jwtSecret);

export async function createSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });
  return payload as SessionPayload;
}
