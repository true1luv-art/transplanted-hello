/**
 * Integer-safe Hive amount handling.
 *
 * Hive assets carry 3 decimals. Every backend amount decision (expected
 * payments, fee splits, payouts) is computed in integer "milli" units so
 * floating-point drift can never create or destroy HIVE.
 *
 * Runtime-neutral: no chain access, no MongoDB, no React.
 */

/** Hive asset precision — 3 decimals for HIVE / HBD. */
export const HIVE_PRECISION = 3;
const SCALE = 10 ** HIVE_PRECISION;

/** Converts a decimal HIVE amount into integer milli units. */
export function toMilli(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError(`Invalid HIVE amount: ${amount}`);
  return Math.round(amount * SCALE);
}

/** Converts integer milli units back into a decimal HIVE amount. */
export function fromMilli(milli: number): number {
  return Math.round(milli) / SCALE;
}

/** Normalizes an amount to Hive's supported precision. */
export function toHiveAmount(amount: number): number {
  return fromMilli(toMilli(amount));
}

/** Formats an amount as a Hive asset string ("1.000 HIVE"). */
export function formatAsset(amount: number, symbol = "HIVE"): string {
  return `${fromMilli(toMilli(amount)).toFixed(HIVE_PRECISION)} ${symbol}`;
}

/** true when two amounts are equal at Hive precision. */
export function amountsEqual(a: number, b: number): boolean {
  return toMilli(a) === toMilli(b);
}

/** Multiplies a unit price by a whole count without floating drift. */
export function multiplyAmount(unitPrice: number, count: number): number {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Invalid count: ${count}`);
  }
  return fromMilli(toMilli(unitPrice) * count);
}

export interface AmountSplit {
  /** Total received, at Hive precision. */
  total: number;
  /** Platform cut. */
  platform: number;
  /** Remainder paid to the counterparty (creator / seller). */
  counterparty: number;
}

/**
 * Splits a received amount into a percentage-based platform cut and the
 * remainder. The platform cut is floored, and the remainder is derived by
 * subtraction, so `platform + counterparty === total` always holds and the
 * split can never distribute more than was received.
 */
export function splitAmount(total: number, platformPercent: number): AmountSplit {
  const totalMilli = toMilli(total);
  if (totalMilli < 0) throw new RangeError(`Cannot split a negative amount: ${total}`);
  if (platformPercent < 0 || platformPercent > 100) {
    throw new RangeError(`Invalid platform percentage: ${platformPercent}`);
  }
  const platformMilli = Math.floor((totalMilli * platformPercent) / 100);
  return {
    total: fromMilli(totalMilli),
    platform: fromMilli(platformMilli),
    counterparty: fromMilli(totalMilli - platformMilli),
  };
}
