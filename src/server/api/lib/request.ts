import { badRequest } from "./errors";

export function genRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function parseIntParam(value: string | null, fallback: number, max = 200): number {
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.trunc(n), max);
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function notSupported(method: string): never {
  throw badRequest(`Method ${method} not allowed`);
}
