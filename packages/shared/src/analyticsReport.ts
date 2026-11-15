/**
 * Everything the Analytics page shows, computed once per data / month / range,
 * plus the one-sentence headlines and the KPI strip. Shared so web and mobile
 * always show the same numbers and say the same thing.
 */
import {
  type AnalyticsRange,
  type AnalyticsRow,
  analyticsWindow,
  biggestShift,
  categoryMix,
  dailyExpenses,
  dayStats,
  moneyFlow,
  movers,
  repeatSpends,
  savingsRates,
  sizeStats,
  spendCurve,
  weekdayAverages,
  weekendRatio,
} from "./analytics";
import { addDays } from "./dates";
import type { StatItem } from "./insights";

/** How far back the transaction-size chart looks; a year of dots would be a smear. */
export const SWARM_DAYS = 90;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11" → "Nov". */
export const shortMonth = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;

/** "2026-11-07" → "Sat, 7 Nov". String based, so no timezone can shift it. */
export function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}, ${day} ${MONTHS[m - 1]}`;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function analyticsReport(
  rows: AnalyticsRow[],
  month: string,
  range: AnalyticsRange,
  todayDate: string,
) {
  const win = analyticsWindow(month, range, todayDate);
  const first = win.dates[0] ?? `${month}-01`;
  const last = win.dates.at(-1) ?? first;
  const inWindow = rows.filter((r) => r.date >= first && r.date <= last);
  const daily = dailyExpenses(rows);
  const mix = categoryMix(rows, win.fullMonths);
  const savings = savingsRates(rows, win.fullMonths);
  const swarmFrom = addDays(last, -(SWARM_DAYS - 1));
  const swarm = inWindow.filter((r) => r.type === "expense" && r.date >= swarmFrom);
  const activeMonths = mix.months.filter((m) => m.total > 0);
  const income = sum(savings.map((s) => s.income));
  const invested = sum(savings.map((s) => s.invested));

  return {
    month,
    /** True while `month` is still running. */
    running: todayDate.startsWith(month),
    win,
    daily,
    flow: moneyFlow(rows, month),
    curve: spendCurve(daily, month, todayDate),
    movers: movers(rows, month, todayDate),
    days: dayStats(daily, win.dates),
    weekdays: weekdayAverages(daily, win.dates),
    mix,
    shift: biggestShift(mix),
    savings,
    swarm,
    swarmDays: Math.min(SWARM_DAYS, win.dates.length),
    size: sizeStats(swarm.map((r) => r.amount)),
    repeats: repeatSpends(inWindow),
    avgMonth: activeMonths.length ? sum(activeMonths.map((m) => m.total)) / activeMonths.length : 0,
    savedRate: income > 0 ? invested / income : null,
  };
}

export type AnalyticsReport = ReturnType<typeof analyticsReport>;

type Money = (minor: number) => string;

/** The four numbers at the top of the page. */
export function analyticsKpis(a: AnalyticsReport, money: Money): StatItem[] {
  return [
    {
      label: "Avg month",
      value: money(Math.round(a.avgMonth / 100) * 100),
      hint: "spending, full months",
    },
    {
      label: "Saved",
      value: a.savedRate === null ? "–" : pct(a.savedRate),
      hint: "of income, invested",
      tone: a.savedRate !== null && a.savedRate > 0 ? "accent" : undefined,
    },
    {
      label: "No-spend days",
      value: String(a.days.noSpendDays),
      hint: `out of ${a.win.dates.length}`,
    },
    {
      label: "Biggest day",
      value: money(a.days.peak?.total ?? 0),
      hint: a.days.peak ? shortDate(a.days.peak.date) : "–",
    },
  ];
}

/** A headline in pieces; `accent` pieces are shown in the accent color. */
export type HeadlinePart = { text: string; accent?: boolean };

export interface AnalyticsHeadlines {
  flow: HeadlinePart[] | null;
  curve: string | null;
  movers: string | null;
  days: string;
  mix: string | null;
  weekdays: string | null;
  savings: string | null;
  sizes: string | null;
  repeats: string | null;
}

/** One sentence per chart that says what it shows. `nameOf` turns a series key into a name. */
export function analyticsHeadlines(
  a: AnalyticsReport,
  money: Money,
  nameOf: (key: string) => string,
): AnalyticsHeadlines {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return {
    flow: flowHeadline(a.flow, money),
    curve: curveHeadline(a, money),
    movers: moversHeadline(a.movers, money, nameOf),
    days: `${plural(a.days.noSpendDays, "no-spend day")}. Longest streak: ${plural(a.days.longestNoSpend, "day")}.`,
    mix: mixHeadline(a.shift, nameOf),
    weekdays: weekdayHeadline(a.weekdays),
    savings: savingsHeadline(a.savings),
    sizes: a.size
      ? a.size.topCount === 1
        ? `Your biggest buy was ${pct(a.size.topShare)} of spending.`
        : `Your biggest ${a.size.topCount} buys were ${pct(a.size.topShare)} of spending.`
      : null,
    repeats: repeatHeadline(a.repeats, money),
  };
}

function flowHeadline(f: AnalyticsReport["flow"], money: Money): HeadlinePart[] | null {
  if (f.shortfall > 0) {
    return [{ text: `You spent and invested ${money(f.shortfall)} more than came in.` }];
  }
  if (f.income === 0)
    return f.spent > 0 ? [{ text: `${money(f.spent)} spent, no income logged.` }] : null;
  return [
    { text: "You kept " },
    { text: pct(f.kept / f.income), accent: true },
    { text: " of what came in." },
  ];
}

function curveHeadline(a: AnalyticsReport, money: Money): string | null {
  const c = a.curve;
  const now = c.current.at(-1) ?? 0;
  if (c.elapsed === 0) return null;
  if (c.previousAtSamePoint === 0) return `${money(now)} spent so far.`;
  const diff = c.previousAtSamePoint - now;
  const when = a.running ? "this point last month" : "the month before";
  return diff >= 0 ? `${money(diff)} less than ${when}.` : `${money(-diff)} more than ${when}.`;
}

function moversHeadline(
  list: AnalyticsReport["movers"],
  money: Money,
  nameOf: (key: string) => string,
) {
  const up = list.filter((m) => m.change > 0).sort((a, b) => b.change - a.change)[0];
  const down = list.filter((m) => m.change < 0).sort((a, b) => a.change - b.change)[0];
  const parts = [
    up && `${nameOf(up.categoryId)} up ${money(up.change)}`,
    down && `${nameOf(down.categoryId)} down ${money(-down.change)}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : null;
}

function mixHeadline(shift: AnalyticsReport["shift"], nameOf: (key: string) => string) {
  if (!shift) return null;
  if (Math.abs(shift.to - shift.from) < 0.03) return "Your spending mix held steady.";
  return `${nameOf(shift.key)} went from ${pct(shift.from)} to ${pct(shift.to)} of your spending.`;
}

/** "Weekends cost 2× a weekday." and friends; shared with the Overview's insight card. */
export function weekdayHeadline(averages: number[]): string | null {
  const r = weekendRatio(averages);
  if (r === null) return null;
  if (r >= 1.15) return `Weekends cost ${r.toFixed(1).replace(/\.0$/, "")}× a weekday.`;
  if (r <= 0.87) return "Weekdays cost you more than weekends.";
  return "Spending is even across the week.";
}

function savingsHeadline(months: AnalyticsReport["savings"]) {
  const pts = months.filter(
    (m): m is (typeof months)[number] & { rate: number } => m.rate !== null,
  );
  const first = pts[0];
  const last = pts.at(-1);
  if (!first || !last) return null;
  if (pts.length === 1) return `${pct(last.rate)} of income invested.`;
  const best = pts.reduce((a, b) => (b.rate > a.rate ? b : a));
  const dir = last.rate >= first.rate ? "Up" : "Down";
  return `${dir} from ${pct(first.rate)} to ${pct(last.rate)}. Best: ${shortMonth(best.month)}, ${pct(best.rate)}.`;
}

function repeatHeadline(items: AnalyticsReport["repeats"], money: Money) {
  const monthly = items.filter((r) => r.monthly);
  if (monthly.length) return `Fixed monthly costs: ${money(sum(monthly.map((r) => r.latest)))}.`;
  const top = items[0];
  return top ? `${top.note}: ${top.count} times, ${money(top.total)}.` : null;
}
