import { config } from "@/lib/config/config";

export const DEV_ACTOR = config.devUser;

export function asActor(username?: string): string {
  return (username ?? DEV_ACTOR).trim().replace(/^@/, "").toLowerCase();
}
