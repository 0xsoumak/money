/**
 * The numbers behind the Analytics page, organised around the questions it answers:
 * am I spending more or less, am I investing enough and regularly, am I living within
 * my income, am I sticking to my budget, and what should I do about it.
 *
 * Pure functions over plain rows, shared so web and mobile say exactly the same thing.
 * Amounts are minor units. Dates are "YYYY-MM-DD", months "YYYY-MM".
 *
 * Comparisons are like for like: on the 23rd, this month so far is compared with what
 * earlier months had reached by their 23rd, not with whole months. Months before the
 * first one with anything logged are ignored, so a new user isn't compared with zeros.
 */
import { type AnalyticsRow, monthsEnding, runningTotals } from "./analytics";
import { shortMonth } from "./analyticsReport";
import { addMonths, daysInMonth, monthOf } from "./dates";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
const daysOf = (m: string) => daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)));
const dayOf = (date: string) => Number(date.slice(8, 10));

/** Movements smaller than this (₹500) aren't worth calling out. */
const NOTABLE = 50_000;
/** How many earlier months "usual" is based on for category comparisons. */
const RECENT = 3;

export interface MonthTotals {
  month: string;
  income: number;
  spent: number;
  invested: number;
  /** income − spent − invested; negative when savings were drawn on. */
  left: number;
}

export interface Mover {
  /** Category id. */
  key: string;
  /** This month so far. */
  now: number;
  /** Average of recent months, at the same point in the month. */
  usual: number;
  diff: number;
}

export type Steadiness = "steady" | "uneven" | "irregular" | "none" | "early";

export interface CategoryBudget {
  key: string;
  limit: number;
  spent: number;
  projected: number;
}

export type ActionTone = "warn" | "good" | "info";
export interface Action {
  id: string;
  tone: ActionTone;
  text: string;
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
  spending: {
    /** Average spent in earlier months by this day of the month; null without history. */
    usualByNow: number | null;
    /** Average spent in a whole earlier month; null without history. */
    usualMonth: number | null;
    /** Where this month is likely to land: so far, plus what usually comes after this day. */
    projected: number;
    /** Categories that moved most against recent months, largest first. */
    movers: Mover[];
  };
  investing: {
    /** Invested ÷ income this month; null without income. */
    rate: number | null;
    /** The same over the history months; null without income there. */
    usualRate: number | null;
    /** Average invested per history month; null without history. */
    usualAmount: number | null;
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

function totalsFor(rows: AnalyticsRow[], month: string, upToDay = 31): MonthTotals {
  let income = 0;
  let spent = 0;
  let invested = 0;
  for (const r of rows) {
    if (monthOf(r.date) !== month || dayOf(r.date) > upToDay) continue;
    if (r.type === "income") income += r.amount;
    else if (r.type === "investment") invested += r.amount;
    else spent += r.amount;
  }
  return { month, income, spent, invested, left: income - spent - invested };
}

/** Expense total per category per month, for categories and same-point comparisons. */
function categoryDaily(rows: AnalyticsRow[]) {
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.type !== "expense") continue;
    let m = out.get(r.categoryId);
    if (!m) out.set(r.categoryId, (m = new Map()));
    m.set(r.date, (m.get(r.date) ?? 0) + r.amount);
  }
  return out;
}

/** Spent in `month` by `day` (clamped to the month's length), from a date → amount map. */
function byDay(daily: Map<string, number>, month: string, day: number): number {
  const totals = runningTotals(daily, month);
  return totals[Math.min(day, totals.length) - 1] ?? 0;
}

export function decisions(input: {
  rows: AnalyticsRow[];
  month: string;
  range: number;
  todayDate: string;
  budgets: Budgets;
}): Decisions {
  const { rows, month, range, todayDate, budgets } = input;
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
  const history = historyMonths.map((m) => totalsFor(rows, m));
  const current = totalsFor(rows, month, elapsed);

  // ── Spending ──
  const daily = new Map<string, number>();
  for (const r of rows)
    if (r.type === "expense") daily.set(r.date, (daily.get(r.date) ?? 0) + r.amount);
  const usualByNow = avg(historyMonths.map((m) => byDay(daily, m, elapsed)));
  const usualMonth = avg(history.map((h) => h.spent));
  // What usually still comes after this day; without history, carry today's pace forward.
  const usualRest = avg(
    historyMonths.map((m) => {
      const t = runningTotals(daily, m);
      return (t.at(-1) ?? 0) - (t[Math.min(elapsed, t.length) - 1] ?? 0);
    }),
  );
  const projected =
    elapsed >= days
      ? current.spent
      : usualRest !== null
        ? current.spent + usualRest
        : elapsed > 0
          ? Math.round((current.spent / elapsed) * days)
          : 0;

  const perCategory = categoryDaily(rows);
  const recent = historyMonths.slice(-RECENT);
  const movers: Mover[] =
    recent.length === 0
      ? []
      : [...perCategory]
          .map(([key, d]) => {
            const now = byDay(d, month, elapsed);
            const usual = Math.round(sum(recent.map((m) => byDay(d, m, elapsed))) / recent.length);
            return { key, now, usual, diff: now - usual };
          })
          .filter((m) => Math.abs(m.diff) >= NOTABLE)
          .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
          .slice(0, 5);

  // ── Investing ──
  const hIncome = sum(history.map((h) => h.income));
  const investing = {
    rate: current.income > 0 ? current.invested / current.income : null,
    usualRate: hIncome > 0 ? sum(history.map((h) => h.invested)) / hIncome : null,
    usualAmount: avg(history.map((h) => h.invested)),
  };

  // A running month only counts once something is invested: it isn't missed yet.
  const consMonths = [
    ...history.map((h) => ({ month: h.month, invested: h.invested })),
    ...(!running || current.invested > 0 ? [{ month, invested: current.invested }] : []),
  ];
  const hits = consMonths.filter((m) => m.invested > 0);
  let streak = 0;
  for (let i = consMonths.length - 1; i >= 0 && (consMonths[i]?.invested ?? 0) > 0; i--) streak++;
  const amounts = hits.map((m) => m.invested);
  const mean = avg(amounts) ?? 0;
  const cv =
    amounts.length > 1 && mean > 0
      ? Math.sqrt(sum(amounts.map((a) => (a - mean) ** 2)) / amounts.length) / mean
      : 0;
  const steadiness: Steadiness =
    consMonths.length < 2
      ? "early"
      : hits.length === 0
        ? "none"
        : hits.length / consMonths.length < 0.75
          ? "irregular"
          : cv > 0.6
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
  // A round, slightly generous figure from the last few months.
  const suggested =
    usualMonth !== null && usualMonth > 0 ? Math.ceil(usualMonth / 100_000) * 100_000 : null;
  const categories: CategoryBudget[] = Object.entries(budgets.byCategory)
    .map(([key, limit]) => {
      const d = perCategory.get(key) ?? new Map<string, number>();
      const spent = byDay(d, month, elapsed);
      const rest = avg(
        recent.map((m) => {
          const t = runningTotals(d, m);
          return (t.at(-1) ?? 0) - (t[Math.min(elapsed, t.length) - 1] ?? 0);
        }),
      );
      const projectedCat =
        elapsed >= days
          ? spent
          : rest !== null
            ? spent + Math.round(rest)
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
    spending: { usualByNow, usualMonth, projected, movers },
    investing,
    consistency: { months: consMonths, investedMonths: hits.length, streak, steadiness },
    budget: { overall, suggested, categories },
  };
}

type Money = (minor: number) => string;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Up to four things worth doing, most pressing first. Each is one sentence that states
 * the fact and what to do about it. `name` turns a category id into its name.
 */
export function decisionActions(d: Decisions, money: Money, name: (id: string) => string) {
  const out: (Action & { rank: number })[] = [];
  const left = d.days - d.elapsed;
  const o = d.budget.overall;

  if (d.current.left < 0 && (d.current.income > 0 || !d.running)) {
    out.push({
      id: "shortfall",
      rank: 0,
      tone: "warn",
      text: `You've spent and invested ${money(-d.current.left)} more than you earned this month, so it's coming from savings.`,
    });
  }

  if (o && d.running && left > 0) {
    const room = o.limit - d.current.spent;
    if (room <= 0) {
      out.push({
        id: "budget-over",
        rank: 1,
        tone: "warn",
        text: `You're ${money(-room)} over your ${money(o.limit)} budget with ${plural(left, "day")} to go. Hold off on anything that can wait.`,
      });
    } else if (d.spending.projected > o.limit) {
      out.push({
        id: "budget-pace",
        rank: 1,
        tone: "warn",
        text: `At your usual pace you'll finish about ${money(d.spending.projected - o.limit)} over budget. Keeping to ${money(Math.floor(room / left))} a day for the next ${plural(left, "day")} keeps you within it.`,
      });
    } else {
      out.push({
        id: "budget-ok",
        rank: 5,
        tone: "good",
        text: `On track for your budget: about ${money(o.limit - d.spending.projected)} to spare at month end.`,
      });
    }
  } else if (!o && d.budget.suggested !== null) {
    out.push({
      id: "budget-set",
      rank: 3,
      tone: "info",
      text: `Set a monthly budget. You've averaged ${money(d.spending.usualMonth ?? 0)} a month, so ${money(d.budget.suggested)} is a realistic start.`,
    });
  }

  const up = d.spending.movers.find((m) => m.diff > 0);
  const extra = d.spending.usualByNow !== null ? d.current.spent - d.spending.usualByNow : null;
  if (up && extra !== null && extra > 0) {
    out.push({
      id: "mover",
      rank: 2,
      tone: "warn",
      text: `${name(up.key)} is ${money(up.diff)} above usual for this point in the month${
        up.diff >= extra * 0.5 ? ", most of why spending is up" : ""
      }.`,
    });
  } else if (extra !== null && extra < -NOTABLE) {
    out.push({
      id: "spend-down",
      rank: 6,
      tone: "good",
      text: `You've spent ${money(-extra)} less than usual by this point. Consider moving some of it to investments.`,
    });
  }

  const inv = d.investing;
  if (d.running && d.current.invested === 0 && (inv.usualAmount ?? 0) > 0) {
    out.push({
      id: "invest-missing",
      rank: 2,
      tone: "info",
      text: `Nothing invested yet this month. You usually put in ${money(inv.usualAmount ?? 0)}.`,
    });
  } else if (
    inv.rate !== null &&
    inv.usualRate !== null &&
    !d.running &&
    inv.rate < inv.usualRate - 0.05
  ) {
    out.push({
      id: "invest-low",
      rank: 4,
      tone: "info",
      text: `You invested ${pct(inv.rate)} of income, below your usual ${pct(inv.usualRate)}.`,
    });
  }

  const c = d.consistency;
  if (c.steadiness === "irregular") {
    const missed = c.months.filter((m) => m.invested === 0).map((m) => shortMonth(m.month));
    out.push({
      id: "irregular",
      rank: 4,
      tone: "info",
      text: `You invested in ${c.investedMonths} of ${c.months.length} months (missed ${missed.join(", ")}). A fixed monthly SIP date makes it automatic.`,
    });
  } else if (c.steadiness === "none" && c.months.length >= 2) {
    out.push({
      id: "invest-start",
      rank: 3,
      tone: "info",
      text: "No investments in this period. Even a small fixed amount each month builds the habit.",
    });
  }

  if (d.history.length === 0) {
    out.push({
      id: "early",
      rank: 7,
      tone: "info",
      text: "Comparisons start once a full month is logged. Until then this page shows this month only.",
    });
  }

  return out
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 4)
    .map(({ rank: _rank, ...a }) => a);
}
