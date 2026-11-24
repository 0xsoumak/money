/**
 * The numbers behind the Analytics page. Pure functions over plain rows so web
 * and mobile compute exactly the same thing, and so all of it is unit tested.
 * Amounts are minor units. Dates are "YYYY-MM-DD", months "YYYY-MM".
 */
import { addMonths, daysInMonth, eachDay, lastDayOf, monthOf, weekday } from "./dates";
import type { TransactionType } from "./schemas";

export interface AnalyticsRow {
  date: string;
  type: TransactionType;
  categoryId: string;
  amount: number;
  note: string | null;
}

/** How many months the analytics endpoint returns: the 12-month window plus the month before it. */
export const ANALYTICS_MONTHS = 13;

/** The ranges the page offers, in months. */
export const ANALYTICS_RANGES = [3, 6, 12] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** Series beyond this many are folded into one "The rest" series so colors stay distinguishable. */
export const MAX_SERIES = 6;
export const OTHER = "other";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const isExpense = (r: AnalyticsRow) => r.type === "expense";

/** `n` months ending at `end`, oldest first. */
export function monthsEnding(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - (n - 1)));
}

export interface AnalyticsWindow {
  /** Months in the window, oldest first. */
  months: string[];
  /** Months that are over (not the current one), oldest first. Charts of monthly totals use these. */
  fullMonths: string[];
  /** Every date counted: from the window's first day up to today or the window's last day. */
  dates: string[];
}

/**
 * The stretch of time a range covers, ending at the month being viewed.
 * Days after today are never counted. Monthly charts drop a month that is still running
 * (a half month would look like a dip) and reach one month further back instead.
 */
export function analyticsWindow(month: string, range: number, todayDate: string): AnalyticsWindow {
  const months = monthsEnding(month, range);
  const first = months[0] as string;
  const lastDay = lastDayOf(month);
  const end = todayDate < lastDay ? todayDate : lastDay;
  const running = monthOf(todayDate) === month;
  return {
    months,
    fullMonths: running ? monthsEnding(addMonths(month, -1), range) : months,
    dates: eachDay(`${first}-01`, end),
  };
}

/** Expense total per date. */
export function dailyExpenses(rows: AnalyticsRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) if (isExpense(r)) out.set(r.date, (out.get(r.date) ?? 0) + r.amount);
  return out;
}

export interface Ranked {
  /** A category id, or OTHER for the folded remainder. */
  key: string;
  amount: number;
}

/** Sorted high to low; anything past `max - 1` entries is folded into one OTHER entry. */
export function topWithOther(totals: Map<string, number>, max = MAX_SERIES): Ranked[] {
  const sorted = [...totals]
    .filter(([, v]) => v > 0)
    .map(([key, amount]) => ({ key, amount }))
    .sort((a, b) => b.amount - a.amount);
  if (sorted.length <= max) return sorted;
  const kept = sorted.slice(0, max - 1);
  return [...kept, { key: OTHER, amount: sum(sorted.slice(max - 1).map((r) => r.amount)) }];
}

// ── Money flow ──────────────────────────────────────────────────────────────

export interface MoneyFlow {
  income: number;
  spent: number;
  invested: number;
  /** Income left after spending and investing. 0 when they exceed income. */
  kept: number;
  /** How much spending and investing exceeded income (drawn from savings). */
  shortfall: number;
  /** Spending by category, high to low, folded to MAX_SERIES. */
  spending: Ranked[];
}

/** Where one month's money went: income into spent, invested and kept; spent into categories. */
export function moneyFlow(rows: AnalyticsRow[], month: string): MoneyFlow {
  let income = 0;
  let invested = 0;
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    if (monthOf(r.date) !== month) continue;
    if (r.type === "income") income += r.amount;
    else if (r.type === "investment") invested += r.amount;
    else byCategory.set(r.categoryId, (byCategory.get(r.categoryId) ?? 0) + r.amount);
  }
  const spent = sum([...byCategory.values()]);
  const out = spent + invested;
  return {
    income,
    spent,
    invested,
    kept: Math.max(0, income - out),
    shortfall: Math.max(0, out - income),
    spending: topWithOther(byCategory),
  };
}

/**
 * Ribbons between two stacks with the same total: each pair of segments that
 * overlap on the shared scale gets one ribbon covering [start, end) of it.
 * Lets the money-flow chart be drawn without a layout library.
 */
export function stackLinks(
  from: number[],
  to: number[],
): { from: number; to: number; start: number; end: number }[] {
  const edges = (xs: number[]) => {
    let acc = 0;
    return xs.map((x) => {
      const band = { start: acc, end: acc + x };
      acc += x;
      return band;
    });
  };
  const B = edges(to);
  const links: { from: number; to: number; start: number; end: number }[] = [];
  edges(from).forEach((a, i) => {
    B.forEach((b, j) => {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) links.push({ from: i, to: j, start, end });
    });
  });
  return links;
}

// ── Spend curve ─────────────────────────────────────────────────────────────

/** Running total of spending for each day of a month (index 0 = day 1). */
export function runningTotals(daily: Map<string, number>, month: string): number[] {
  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  let acc = 0;
  return Array.from({ length: days }, (_, i) => {
    acc += daily.get(`${month}-${String(i + 1).padStart(2, "0")}`) ?? 0;
    return acc;
  });
}

export interface SpendCurve {
  days: number;
  /** Days of this month that have happened (all of them for a past month). */
  elapsed: number;
  /** This month's running total, `elapsed` points. */
  current: number[];
  /** Last month's running total, every day of it. */
  previous: number[];
  /** Average running total of up to six earlier months that had spending, `days` points; null if none. */
  average: number[] | null;
  /** Last month's running total on the same day of the month as today (or its end). */
  previousAtSamePoint: number;
}

export function spendCurve(
  daily: Map<string, number>,
  month: string,
  todayDate: string,
): SpendCurve {
  const full = runningTotals(daily, month);
  const days = full.length;
  const elapsed =
    monthOf(todayDate) === month
      ? Number(todayDate.slice(8))
      : todayDate < `${month}-01`
        ? 0
        : days;
  const previous = runningTotals(daily, addMonths(month, -1));
  const earlier = monthsEnding(addMonths(month, -1), 6)
    .map((m) => runningTotals(daily, m))
    .filter((r) => (r.at(-1) ?? 0) > 0);
  // Shorter months carry their final total forward so every day has a value.
  const average =
    earlier.length === 0
      ? null
      : Array.from({ length: days }, (_, i) =>
          Math.round(sum(earlier.map((r) => r[Math.min(i, r.length - 1)] ?? 0)) / earlier.length),
        );
  const samePoint = elapsed === days ? previous.length : Math.min(elapsed, previous.length);
  return {
    days,
    elapsed,
    current: full.slice(0, elapsed),
    previous,
    average,
    previousAtSamePoint: samePoint > 0 ? (previous[samePoint - 1] ?? 0) : 0,
  };
}

// ── Days ────────────────────────────────────────────────────────────────────

export interface DayStats {
  spentDays: number;
  noSpendDays: number;
  /** Longest run of consecutive days with no spending. */
  longestNoSpend: number;
  peak: { date: string; total: number } | null;
}

export function dayStats(daily: Map<string, number>, dates: string[]): DayStats {
  let spentDays = 0;
  let run = 0;
  let longest = 0;
  let peak: DayStats["peak"] = null;
  for (const date of dates) {
    const total = daily.get(date) ?? 0;
    if (total > 0) {
      spentDays++;
      run = 0;
      if (!peak || total > peak.total) peak = { date, total };
    } else {
      run++;
      longest = Math.max(longest, run);
    }
  }
  return { spentDays, noSpendDays: dates.length - spentDays, longestNoSpend: longest, peak };
}

/**
 * Cut points that split the days with spending into five heat levels
 * (0 = nothing spent, then four quartile-ish steps). Returns the three upper bounds
 * for levels 1–3; anything above the last is level 4.
 */
export function heatLevels(values: number[]): [number, number, number] {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length === 0) return [0, 0, 0];
  const q = (p: number) => nz[Math.floor(p * (nz.length - 1))] as number;
  return [q(0.25), q(0.5), q(0.8)];
}

export function heatLevel(value: number, cuts: [number, number, number]): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  if (value <= cuts[0]) return 1;
  if (value <= cuts[1]) return 2;
  if (value <= cuts[2]) return 3;
  return 4;
}

/** Average spending per weekday (Monday first) over the given dates, counting days with no spending. */
export function weekdayAverages(daily: Map<string, number>, dates: string[]): number[] {
  const total = [0, 0, 0, 0, 0, 0, 0];
  const count = [0, 0, 0, 0, 0, 0, 0];
  for (const date of dates) {
    const w = weekday(date);
    total[w] = (total[w] ?? 0) + (daily.get(date) ?? 0);
    count[w] = (count[w] ?? 0) + 1;
  }
  return total.map((t, i) => (count[i] ? Math.round(t / (count[i] as number)) : 0));
}

/** Average weekend day ÷ average weekday, or null without weekday spending. */
export function weekendRatio(averages: number[]): number | null {
  const weekdays = sum(averages.slice(0, 5)) / 5;
  const weekend = sum(averages.slice(5)) / 2;
  return weekdays > 0 ? weekend / weekdays : null;
}

// ── Months ──────────────────────────────────────────────────────────────────

/** Total spending in each of `months`, in order. */
export function monthlySpending(rows: AnalyticsRow[], months: string[]): number[] {
  const at = new Map(months.map((m) => [m, 0]));
  for (const r of rows) {
    const m = monthOf(r.date);
    if (isExpense(r) && at.has(m)) at.set(m, (at.get(m) ?? 0) + r.amount);
  }
  return months.map((m) => at.get(m) ?? 0);
}

export interface SavingsMonth {
  month: string;
  income: number;
  invested: number;
  /** invested ÷ income, or null for a month without income. */
  rate: number | null;
}

export function savingsRates(rows: AnalyticsRow[], months: string[]): SavingsMonth[] {
  const at = new Map(months.map((m) => [m, { income: 0, invested: 0 }]));
  for (const r of rows) {
    const t = at.get(monthOf(r.date));
    if (!t) continue;
    if (r.type === "income") t.income += r.amount;
    else if (r.type === "investment") t.invested += r.amount;
  }
  return months.map((month) => {
    const t = at.get(month) ?? { income: 0, invested: 0 };
    return { month, ...t, rate: t.income > 0 ? t.invested / t.income : null };
  });
}

// ── Categories ──────────────────────────────────────────────────────────────

/**
 * Spending by category over several months, high to low, folded so at most `max`
 * slices remain (the smallest go into OTHER). For a donut of where money usually goes.
 */
export function categoryShare(rows: AnalyticsRow[], months: string[], max = 7): Ranked[] {
  const within = new Set(months);
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!isExpense(r) || !within.has(monthOf(r.date))) continue;
    totals.set(r.categoryId, (totals.get(r.categoryId) ?? 0) + r.amount);
  }
  return topWithOther(totals, max);
}
