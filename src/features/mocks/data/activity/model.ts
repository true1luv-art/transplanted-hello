import type { Activity, NewActivity, NewTransaction, Transaction } from "@/features/types/domain/activity";

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function buildActivity(input: NewActivity): Activity {
  return { ...input, id: uid("act"), createdAt: input.createdAt ?? new Date().toISOString() };
}

export function buildTransaction(input: NewTransaction): Transaction {
  return { ...input, id: uid("tx"), createdAt: input.createdAt ?? new Date().toISOString() };
}

export const newId = uid;
