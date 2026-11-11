import { daysInMonth } from "./dates";

export interface ExpenseLike {
  type: "expense" | "income";
  date: string;
  amount: number;
}

export interface MonthInsights {
  /** Days in the month. */
  days: number;
  /** Days counted so far: today's day of month for the current month, all for past, 0 for future. */
  elapsed: number;
  isCurrent: boolean;
  /** Expense total per date (YYYY-MM-DD), only dates with spending. */
  daily: Map<string, number>;
  /** Biggest day, or null when nothing was spent. */
  peak: { date: string; total: number } | null;
  /** Average per elapsed day, rounded to whole currency units. */
  average: number;
  /** Average × days: where the month lands at the current pace. */
  projected: number;
  /** Overall budget spread evenly over the month (whole currency units), or null without one. */
  dailyBudget: number | null;
}

/**
 * Numbers behind the overview charts and stat strip. Shared so web and mobile
 * always agree. Amounts are minor units.
 */
export function monthInsights({
  month,
  todayDate,
  spent,
  transactions,
  overallBudget,
}: {
  month: string;
  todayDate: string;
  spent: number;
  transactions: ExpenseLike[];
  overallBudget: number | null;
}): MonthInsights {
  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const isCurrent = todayDate.startsWith(month);
  const isFuture = `${month}-01` > todayDate;
  const elapsed = isCurrent ? Number(todayDate.slice(8)) : isFuture ? 0 : days;

  const daily = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense") daily.set(t.date, (daily.get(t.date) ?? 0) + t.amount);
  }
  let peak: MonthInsights["peak"] = null;
  for (const [date, total] of daily) if (!peak || total > peak.total) peak = { date, total };

  // Whole currency units: paise on an average is noise.
  const average = elapsed > 0 ? Math.round(spent / elapsed / 100) * 100 : 0;

  return {
    days,
    elapsed,
    isCurrent,
    daily,
    peak,
    average,
    projected: average * days,
    dailyBudget: overallBudget !== null ? Math.round(overallBudget / days / 100) * 100 : null,
  };
}

/** "▲ 12% more" / "▼ 8% less" versus a previous amount, or null when there is nothing to compare. */
export function changeVs(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  return current >= previous
    ? `▲ ${Math.round((current / previous - 1) * 100)}% more`
    : `▼ ${Math.round((1 - current / previous) * 100)}% less`;
}

export interface StatItem {
  label: string;
  value: string;
  hint: string;
  tone?: "danger";
}

/** The four overview stats, worded the same on every platform. */
export function overviewStats(
  ins: MonthInsights,
  {
    spent,
    prevSpent,
    overallBudget,
    money,
  }: {
    spent: number;
    prevSpent: number;
    overallBudget: number | null;
    money: (minor: number) => string;
  },
): StatItem[] {
  const pace: StatItem = ins.isCurrent
    ? {
        label: "On pace for",
        value: money(ins.projected),
        hint:
          overallBudget === null
            ? "by month end"
            : ins.projected > overallBudget
              ? `${money(ins.projected - overallBudget)} over budget`
              : `${money(overallBudget - ins.projected)} under budget`,
        tone: overallBudget !== null && ins.projected > overallBudget ? "danger" : undefined,
      }
    : {
        label: "Days spent",
        value: `${ins.daily.size} of ${ins.days}`,
        hint: `${ins.days - ins.daily.size} no-spend days`,
      };

  const change = changeVs(spent, prevSpent);
  return [
    {
      label: "Daily average",
      value: money(ins.average),
      hint: `over ${ins.elapsed} ${ins.elapsed === 1 ? "day" : "days"}`,
    },
    pace,
    {
      label: "Last month",
      value: money(prevSpent),
      hint:
        prevSpent === 0
          ? "nothing logged"
          : ins.isCurrent
            ? `${Math.round((spent / prevSpent) * 100)}% of it spent so far`
            : `${change} this month`,
    },
    {
      label: "Biggest day",
      value: money(ins.peak?.total ?? 0),
      hint: ins.peak
        ? new Date(`${ins.peak.date}T00:00:00`).toLocaleDateString("en", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })
        : "–",
    },
  ];
}
