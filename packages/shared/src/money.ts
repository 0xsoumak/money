/**
 * Money is always stored and transmitted as an integer number of minor units
 * (paise, cents). Only convert to a decimal for display or user input.
 */

/** Largest amount we accept: 10 billion major units. Keeps us far from float-unsafe integers. */
export const MAX_MINOR = 1_000_000_000_000;

const DECIMAL_INPUT = /^(\d+)(?:\.(\d{0,2}))?$/;

/**
 * Parse user input like "125", "125.5", "1,250.50" into minor units.
 * Done on the string so values like "0.29" never pass through float math.
 * Returns null for anything that isn't a valid non-negative amount with at most 2 decimals.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/[,\s_]/g, "");
  const match = DECIMAL_INPUT.exec(cleaned);
  if (!match) return null;
  const whole = match[1] ?? "0";
  const frac = (match[2] ?? "").padEnd(2, "0");
  const minor = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return null;
  return minor;
}

/** Minor units → major units as a number. For display math only; never store the result. */
export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Minor units → plain decimal string without grouping, e.g. 12550 → "125.50". */
export function toDecimalString(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac}`;
}

export interface FormatMoneyOptions {
  currency?: string;
  locale?: string;
  /** Hide ".00" on whole amounts. Default true. */
  trimZeroFraction?: boolean;
}

/** Minor units → localized currency string, e.g. 12550 → "₹125.50". */
export function formatMoney(minor: number, opts: FormatMoneyOptions = {}): string {
  const { currency = "INR", locale = "en-IN", trimZeroFraction = true } = opts;
  const isWhole = minor % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: trimZeroFraction && isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(fromMinor(minor));
}
