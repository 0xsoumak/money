/**
 * Transaction dates are plain calendar dates ("YYYY-MM-DD") in the user's local
 * time, never UTC timestamps. Months are "YYYY-MM". Everything here is string
 * based so a timezone can never shift a date into a different day or month.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function isValidMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month. UTC avoids DST quirks.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's date in the device's local timezone. */
export function today(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Current month in the device's local timezone. */
export function currentMonth(now: Date = new Date()): string {
  return today(now).slice(0, 7);
}

/** "2026-11-10" → "2026-11" */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Shift a "YYYY-MM" month by n months (n may be negative). */
export function addMonths(month: string, n: number): string {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`Invalid month: ${month}`);
  const index = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/**
 * Date bounds for a month: `start` is inclusive, `end` is exclusive (first day of the next month).
 * Query with `date >= start AND date < end`. String comparison works because the format is fixed width.
 */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: `${addMonths(month, 1)}-01` };
}

/** Shift a "YYYY-MM-DD" date by n days (n may be negative). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Day of the week for a "YYYY-MM-DD" date, Monday = 0 … Sunday = 6. */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Every date from `start` to `end`, both inclusive. Empty when end is before start. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Last calendar date of a "YYYY-MM" month. */
export function lastDayOf(month: string): string {
  return `${month}-${pad(daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7))))}`;
}
