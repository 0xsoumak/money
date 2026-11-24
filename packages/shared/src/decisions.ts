/**
 * The numbers behind the Analytics page, organised around the questions it answers:
 * am I spending more or less, am I investing enough and regularly, am I living within
 * my income, am I sticking to my budget, and what should I do about it.
 *
 * Pure functions over plain rows, shared so web and mobile say exactly the same thing.
 * Amounts are minor units. Dates are "YYYY-MM-DD", months "YYYY-MM".
 *
 * How it stays honest:
 * - Like for like: on the 23rd, this month so far is compared with what earlier months had
 *   reached by their 23rd, not with whole months.
 * - Fixed costs (categories marked fixed: rent, EMIs, family support) are split out. Verdicts
 *   are about flexible spending, the part your choices change.
 * - "Usual" is a typical range (median, middle half), not a mean one odd month can drag.
 * - Months before anything was logged are ignored, and every verdict says how much history
 *   it rests on. Thin logging is flagged, since missing entries look like spending less.
 */
import { type AnalyticsRow, monthsEnding, runningTotals } from "./analytics";
import { shortMonth } from "./analyticsReport";
import { addMonths, daysInMonth, monthOf } from "./dates";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const daysOf = (m: string) => daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)));
const dayOf = (date: string) => Number(date.slice(8, 10));

/** Differences smaller than this (₹500) aren't worth calling out. */
const NOTABLE = 50_000;
/** How many earlier months category comparisons use. */
const RECENT = 3;
/** Months of history before a comparison counts as more than an early read. */
const SOLID = 3;
/** Pace warnings wait this many days; before that a projection is mostly noise. */
const SETTLE_DAYS = 7;
/** Below this share of days with any entry, logging looks incomplete. */
const THIN = 0.3;

/** Whether a category's change against usual is big enough to call out. */
function isNotable(m: { diff: number; usual: number }): boolean {
  return Math.abs(m.diff) >= Math.max(NOTABLE, m.usual * 0.25);
}

// ── Typical range ───────────────────────────────────────────────────────────

/** A typical value and the range around it. */
export interface Range {
  low: number;
  mid: number;
  high: number;
  /** How many months it's based on. */
  n: number;
}

function quantile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(
    (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (i - lo),
  );
}

/** Median with the middle half around it; with fewer than four values, lowest to highest. */
export function typicalRange(values: number[]): Range | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const wide = s.length < 4;
  return {
    low: wide ? (s[0] as number) : quantile(s, 0.25),
    mid: quantile(s, 0.5),
    high: wide ? (s.at(-1) as number) : quantile(s, 0.75),
    n: s.length,
  };
}

/** Where a value sits against a range, with some slack so tiny differences read as usual. */
export function against(value: number, r: Range): "above" | "below" | "within" {
  const slack = Math.max(NOTABLE, r.mid * 0.1);
  if (value > r.high + slack) return "above";
  if (value < r.low - slack) return "below";
  return "within";
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface MonthTotals {
  month: string;
  income: number;
  /** fixed + flexible. */
  spent: number;
  fixed: number;
  flexible: number;
  invested: number;
  /** income − spent − invested; negative when savings were drawn on. */
  left: number;
}

export interface Mover {
  /** Category id. */
  key: string;
  /** This month so far. */
  now: number;
  /** Typical of recent months, at the same point in the month. */
  usual: number;
  diff: number;
}

/** One day on the pace chart: the usual running total by then, as a range. */
export interface PaceDay {
  low: number;
  mid: number;
  high: number;
}

export type Steadiness = "steady" | "uneven" | "irregular" | "none" | "early";
/** How much history a comparison rests on. */
export type Confidence = "none" | "early" | "solid";

export interface CategoryBudget {
  key: string;
  limit: number;
  spent: number;
  projected: number;
}

export interface Budgets {
  overall: number | null;
  /** Category id → monthly limit. */
  byCategory: Record<string, number>;
}

export interface Decisions {
  month: string;
  /** True while `month` is still running. */
  running: boolean;
  /** Days of `month` counted (today's date in a running month, else all). */
  elapsed: number;
  days: number;
  /** Earlier months compared against: up to `range`, oldest first, none before tracking began. */
  history: MonthTotals[];
  /** The month being viewed, so far. */
  current: MonthTotals;
  confidence: Confidence;
  /** Whether any category is marked fixed. */
  hasFixed: boolean;
  logging: {
    /** Days of this month (so far) with at least one entry. */
    loggedDays: number;
    /** Which days, 1-based, for a day strip. */
    logged: boolean[];
    thin: boolean;
  };
  spending: {
    /** Flexible spending typical of earlier months by this day; null without history. */
    usualByNow: Range | null;
    verdict: "above" | "below" | "within" | null;
    /** Whole-month totals (fixed + flexible) of earlier months. */
    usualMonth: Range | null;
    /** Fixed costs in a typical earlier month. */
    usualFixed: number | null;
    /** Where this month is likely to land, as a range. */
    projected: Range;
    /** Flexible categories that moved most against recent months, largest first. */
    movers: Mover[];
    /** Running totals of all spending (fixed + flexible), for a chart of the month. */
    pace: {
      /** This month, day 1 to `elapsed`. */
      current: number[];
      /** The usual running total for every day of the month; null without history. */
      usual: PaceDay[] | null;
    };
  };
  investing: {
    /** Invested ÷ income this month; null without income. */
    rate: number | null;
    /** The same over the history months; null without income there. */
    usualRate: number | null;
    /** Typical invested per history month. */
    usual: Range | null;
  };
  consistency: {
    /** Months looked at: the history plus this month once it's over or has an investment. */
    months: { month: string; invested: number }[];
    investedMonths: number;
    /** Consecutive months with an investment, counting back from the latest. */
    streak: number;
    steadiness: Steadiness;
  };
  budget: {
    overall: {
      limit: number;
      /** Where spending should be by today to land exactly on the limit. */
      expectedByNow: number;
      /** History months that stayed within the limit, and how many were counted. */
      within: number;
      counted: number;
    } | null;
    /** A realistic overall budget from history, when none is set; null without history. */
    suggested: number | null;
    categories: CategoryBudget[];
  };
}

// ── Computation ─────────────────────────────────────────────────────────────

function totalsFor(
  rows: AnalyticsRow[],
  month: string,
  fixedIds: ReadonlySet<string>,
  upToDay = 31,
): MonthTotals {
  let income = 0;
  let fixed = 0;
  let flexible = 0;
  let invested = 0;
  for (const r of rows) {
    if (monthOf(r.date) !== month || dayOf(r.date) > upToDay) continue;
    if (r.type === "income") income += r.amount;
    else if (r.type === "investment") invested += r.amount;
    else if (fixedIds.has(r.categoryId)) fixed += r.amount;
    else flexible += r.amount;
  }
  const spent = fixed + flexible;
  return { month, income, spent, fixed, flexible, invested, left: income - spent - invested };
}

/** Date → amount maps: one per category, one for flexible spending and one for all of it. */
function dailyMaps(rows: AnalyticsRow[], fixedIds: ReadonlySet<string>) {
  const byCategory = new Map<string, Map<string, number>>();
  const flexible = new Map<string, number>();
  const all = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== "expense") continue;
    let m = byCategory.get(r.categoryId);
    if (!m) byCategory.set(r.categoryId, (m = new Map()));
    m.set(r.date, (m.get(r.date) ?? 0) + r.amount);
    all.set(r.date, (all.get(r.date) ?? 0) + r.amount);
    if (!fixedIds.has(r.categoryId)) flexible.set(r.date, (flexible.get(r.date) ?? 0) + r.amount);
  }
  return { byCategory, flexible, all };
}

/** Spent in `month` by `day` (clamped to the month's length). */
function byDay(daily: Map<string, number>, month: string, day: number): number {
  const totals = runningTotals(daily, month);
  return day <= 0 ? 0 : (totals[Math.min(day, totals.length) - 1] ?? 0);
}

/** Spent in `month` after `day`. */
function afterDay(daily: Map<string, number>, month: string, day: number): number {
  const totals = runningTotals(daily, month);
  return (totals.at(-1) ?? 0) - byDay(daily, month, day);
}

export function decisions(input: {
  rows: AnalyticsRow[];
  month: string;
  range: number;
  todayDate: string;
  budgets: Budgets;
  /** Categories marked fixed. */
  fixedIds?: ReadonlySet<string>;
}): Decisions {
  const { rows, month, range, todayDate, budgets } = input;
  const fixedIds = input.fixedIds ?? new Set<string>();
  const days = daysOf(month);
  const running = monthOf(todayDate) === month;
  const elapsed = running ? dayOf(todayDate) : todayDate < `${month}-01` ? 0 : days;

  // Tracking began with the first month that has anything in it.
  const first = rows.reduce<string | null>((f, r) => {
    const m = monthOf(r.date);
    return f === null || m < f ? m : f;
  }, null);
  const historyMonths = monthsEnding(addMonths(month, -1), range).filter(
    (m) => first !== null && m >= first,
  );
  const history = historyMonths.map((m) => totalsFor(rows, m, fixedIds));
  const current = totalsFor(rows, month, fixedIds, elapsed);
  const confidence: Confidence =
    history.length === 0 ? "none" : history.length < SOLID ? "early" : "solid";

  // ── Logging ──
  const logged = Array.from({ length: elapsed }, () => false);
  for (const r of rows) {
    if (monthOf(r.date) === month && dayOf(r.date) <= elapsed) logged[dayOf(r.date) - 1] = true;
  }
  const loggedDays = logged.filter(Boolean).length;
  const thin = elapsed >= SETTLE_DAYS && loggedDays / elapsed < THIN;

  // ── Spending ──
  const daily = dailyMaps(rows, fixedIds);
  const usualByNow = typicalRange(historyMonths.map((m) => byDay(daily.flexible, m, elapsed)));
  const verdict = usualByNow ? against(current.flexible, usualByNow) : null;
  const usualMonth = typicalRange(history.map((h) => h.spent));
  const usualFixed = typicalRange(history.map((h) => h.fixed))?.mid ?? null;

  // Fixed costs land once a month: expect at least the usual amount. Flexible spending adds
  // what earlier months spent after this day, or carries today's pace on without history.
  const fixedEnd = Math.max(current.fixed, running ? (usualFixed ?? 0) : 0);
  const rest = typicalRange(historyMonths.map((m) => afterDay(daily.flexible, m, elapsed)));
  const flexEnd = (extra: number) => current.flexible + extra;
  const projected: Range =
    elapsed >= days
      ? { low: current.spent, mid: current.spent, high: current.spent, n: history.length }
      : rest
        ? {
            low: fixedEnd + flexEnd(rest.low),
            mid: fixedEnd + flexEnd(rest.mid),
            high: fixedEnd + flexEnd(rest.high),
            n: rest.n,
          }
        : (() => {
            const pace =
              elapsed > 0 ? Math.round((current.flexible / elapsed) * days) : current.flexible;
            return { low: fixedEnd + pace, mid: fixedEnd + pace, high: fixedEnd + pace, n: 0 };
          })();

  const recent = historyMonths.slice(-RECENT);
  const compared: Mover[] =
    recent.length === 0
      ? []
      : [...daily.byCategory]
          .filter(([key]) => !fixedIds.has(key))
          .map(([key, d]) => {
            const now = byDay(d, month, elapsed);
            const usual = typicalRange(recent.map((m) => byDay(d, m, elapsed)))?.mid ?? 0;
            return { key, now, usual, diff: now - usual };
          })
          .filter((m) => m.now > 0 || m.usual > 0);
  const movers = compared
    .filter((m) => isNotable(m))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 5);

  // Running totals for the pace chart. Shorter months hold their final total to the end.
  const runs = historyMonths.map((m) => runningTotals(daily.all, m));
  const pace = {
    current: runningTotals(daily.all, month).slice(0, elapsed),
    usual:
      runs.length === 0
        ? null
        : Array.from({ length: days }, (_, i) => {
            const r = typicalRange(runs.map((run) => run[Math.min(i, run.length - 1)] ?? 0));
            return { low: r?.low ?? 0, mid: r?.mid ?? 0, high: r?.high ?? 0 };
          }),
  };

  // ── Investing ──
  const hIncome = sum(history.map((h) => h.income));
  const investing = {
    rate: current.income > 0 ? current.invested / current.income : null,
    usualRate: hIncome > 0 ? sum(history.map((h) => h.invested)) / hIncome : null,
    usual: typicalRange(history.map((h) => h.invested)),
  };

  // A running month only counts once something is invested: it isn't missed yet.
  const consMonths = [
    ...history.map((h) => ({ month: h.month, invested: h.invested })),
    ...(!running || current.invested > 0 ? [{ month, invested: current.invested }] : []),
  ];
  const hits = consMonths.filter((m) => m.invested > 0);
  let streak = 0;
  for (let i = consMonths.length - 1; i >= 0 && (consMonths[i]?.invested ?? 0) > 0; i--) streak++;
  // "Uneven" when the middle half of amounts spans more than the typical amount itself.
  const amounts = typicalRange(hits.map((m) => m.invested));
  const swings = !!amounts && amounts.n >= 3 && amounts.high - amounts.low > amounts.mid;
  const steadiness: Steadiness =
    consMonths.length < 2
      ? "early"
      : hits.length === 0
        ? "none"
        : hits.length / consMonths.length < 0.75
          ? "irregular"
          : swings
            ? "uneven"
            : "steady";

  // ── Budget ──
  const overall =
    budgets.overall !== null
      ? {
          limit: budgets.overall,
          expectedByNow: Math.round((budgets.overall * elapsed) / days),
          within: history.filter((h) => h.spent <= (budgets.overall as number)).length,
          counted: history.length,
        }
      : null;
  // A round figure at the top of the usual range, so a normal month fits.
  const suggested =
    usualMonth && usualMonth.high > 0 ? Math.ceil(usualMonth.high / 100_000) * 100_000 : null;
  const categories: CategoryBudget[] = Object.entries(budgets.byCategory)
    .map(([key, limit]) => {
      const d = daily.byCategory.get(key) ?? new Map<string, number>();
      const spent = byDay(d, month, elapsed);
      const after = typicalRange(recent.map((m) => afterDay(d, m, elapsed)))?.mid;
      const projectedCat =
        elapsed >= days
          ? spent
          : after !== undefined
            ? spent + after
            : elapsed > 0
              ? Math.round((spent / elapsed) * days)
              : 0;
      return { key, limit, spent, projected: projectedCat };
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);

  return {
    month,
    running,
    elapsed,
    days,
    history,
    current,
    confidence,
    hasFixed: fixedIds.size > 0,
    logging: { loggedDays, logged, thin },
    spending: {
      usualByNow,
      verdict,
      usualMonth,
      usualFixed,
      projected,
      movers,
      pace,
    },
    investing,
    consistency: { months: consMonths, investedMonths: hits.length, streak, steadiness },
    budget: { overall, suggested, categories },
  };
}
