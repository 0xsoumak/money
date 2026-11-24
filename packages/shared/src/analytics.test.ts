import { describe, expect, it } from "vitest";
import {
  type AnalyticsRow,
  analyticsWindow,
  categoryRanks,
  dailyExpenses,
  dayStats,
  heatLevel,
  heatLevels,
  moneyFlow,
  OTHER,
  runningTotals,
  savingsRates,
  spendCurve,
  spendingSplit,
  stackLinks,
  topWithOther,
  weekdayAverages,
  weekendRatio,
} from "./analytics";

const row = (
  date: string,
  amount: number,
  categoryId = "food",
  type: AnalyticsRow["type"] = "expense",
  note: string | null = null,
): AnalyticsRow => ({ date, amount, categoryId, type, note });

describe("analyticsWindow", () => {
  it("stops at today and skips the running month for monthly charts", () => {
    const w = analyticsWindow("2026-11", 3, "2026-11-15");
    expect(w.months).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(w.fullMonths).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(w.dates[0]).toBe("2026-09-01");
    expect(w.dates.at(-1)).toBe("2026-11-15");
  });

  it("uses whole months for a past month", () => {
    const w = analyticsWindow("2026-06", 3, "2026-11-15");
    expect(w.fullMonths).toEqual(w.months);
    expect(w.dates.at(-1)).toBe("2026-06-30");
  });
});

describe("topWithOther", () => {
  it("folds everything past the fifth series into Other", () => {
    const totals = new Map(["a", "b", "c", "d", "e", "f", "g"].map((k, i) => [k, 70 - i * 10]));
    const ranked = topWithOther(totals);
    expect(ranked.map((r) => r.key)).toEqual(["a", "b", "c", "d", "e", OTHER]);
    expect(ranked.at(-1)?.amount).toBe(20 + 10);
  });

  it("drops zero totals", () => {
    expect(topWithOther(new Map([["a", 0]]))).toEqual([]);
  });
});

describe("moneyFlow", () => {
  const rows = [
    row("2026-11-01", 100_000, "salary", "income"),
    row("2026-11-02", 30_000, "mf", "investment"),
    row("2026-11-03", 20_000, "food"),
    row("2026-11-04", 5_000, "bills"),
    row("2026-10-30", 99_999, "food"),
  ];

  it("splits income into spent, invested and kept", () => {
    const f = moneyFlow(rows, "2026-11");
    expect(f).toMatchObject({ income: 100_000, spent: 25_000, invested: 30_000, kept: 45_000 });
    expect(f.shortfall).toBe(0);
    expect(f.spending).toEqual([
      { key: "food", amount: 20_000 },
      { key: "bills", amount: 5_000 },
    ]);
  });

  it("reports a shortfall when going out exceeds coming in", () => {
    const f = moneyFlow(
      [row("2026-11-01", 10_000, "s", "income"), row("2026-11-02", 15_000)],
      "2026-11",
    );
    expect(f.kept).toBe(0);
    expect(f.shortfall).toBe(5_000);
  });
});

describe("stackLinks", () => {
  it("joins overlapping segments of two equal stacks", () => {
    expect(stackLinks([10], [3, 7])).toEqual([
      { from: 0, to: 0, start: 0, end: 3 },
      { from: 0, to: 1, start: 3, end: 10 },
    ]);
    expect(stackLinks([6, 4], [5, 5]).map((l) => [l.from, l.to, l.end - l.start])).toEqual([
      [0, 0, 5],
      [0, 1, 1],
      [1, 1, 4],
    ]);
  });
});

describe("spend curve", () => {
  const daily = dailyExpenses([
    row("2026-10-01", 100),
    row("2026-10-05", 200),
    row("2026-10-31", 50),
    row("2026-11-02", 300),
    row("2026-11-02", 10, "x", "income"),
  ]);

  it("builds running totals for every day", () => {
    const r = runningTotals(daily, "2026-11");
    expect(r).toHaveLength(30);
    expect(r[0]).toBe(0);
    expect(r[1]).toBe(300);
    expect(r[29]).toBe(300);
  });

  it("compares with last month at the same point", () => {
    const c = spendCurve(daily, "2026-11", "2026-11-05");
    expect(c.elapsed).toBe(5);
    expect(c.current).toEqual([0, 300, 300, 300, 300]);
    expect(c.previous).toHaveLength(31);
    expect(c.previousAtSamePoint).toBe(300);
    expect(c.average).toHaveLength(30);
    expect(c.average?.[29]).toBe(300); // October day 30; its ₹50 lands on the 31st
  });

  it("compares whole months once a month is over", () => {
    expect(spendCurve(daily, "2026-11", "2026-12-03").previousAtSamePoint).toBe(350);
  });

  it("has no average without earlier spending", () => {
    expect(spendCurve(new Map(), "2026-11", "2026-11-05").average).toBeNull();
  });
});

describe("days", () => {
  const daily = new Map([
    ["2026-11-02", 500],
    ["2026-11-06", 900],
  ]);
  const dates = [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
    "2026-11-06",
  ];

  it("counts spending days, no-spend streaks and the peak", () => {
    expect(dayStats(daily, dates)).toEqual({
      spentDays: 2,
      noSpendDays: 4,
      longestNoSpend: 3,
      peak: { date: "2026-11-06", total: 900 },
    });
  });

  it("averages each weekday over every occurrence, spent or not", () => {
    // 2026-11-02 is a Monday; 2026-11-06 a Friday. Each weekday occurs once.
    const avg = weekdayAverages(daily, dates);
    expect(avg[0]).toBe(500);
    expect(avg[4]).toBe(900);
    expect(avg[6]).toBe(0);
  });

  it("compares weekends with weekdays", () => {
    expect(weekendRatio([100, 100, 100, 100, 100, 200, 300])).toBe(2.5);
    expect(weekendRatio([0, 0, 0, 0, 0, 10, 10])).toBeNull();
  });

  it("buckets days into five heat levels", () => {
    const cuts = heatLevels([0, 10, 20, 30, 40, 50]);
    expect(heatLevel(0, cuts)).toBe(0);
    expect(heatLevel(10, cuts)).toBe(1);
    expect(heatLevel(50, cuts)).toBe(4);
  });
});

describe("savingsRates", () => {
  it("divides investing by income, null without income", () => {
    expect(
      savingsRates(
        [row("2026-10-01", 1000, "s", "income"), row("2026-10-02", 250, "mf", "investment")],
        ["2026-10", "2026-11"],
      ),
    ).toEqual([
      { month: "2026-10", income: 1000, invested: 250, rate: 0.25 },
      { month: "2026-11", income: 0, invested: 0, rate: null },
    ]);
  });
});

/** An expense in rupees. */
const r = (date: string, categoryId: string, rupees: number) => row(date, rupees * 100, categoryId);

describe("spendingSplit", () => {
  it("splits one month's spending into fixed and flexible categories, high to low", () => {
    const rows = [
      r("2026-11-01", "rent", 20_000),
      r("2026-11-02", "food", 300),
      r("2026-11-03", "fun", 500),
      r("2026-11-04", "food", 400),
      r("2026-10-04", "food", 9_000),
    ];
    expect(spendingSplit(rows, "2026-11", new Set(["rent"]))).toEqual({
      fixed: [{ key: "rent", amount: 2_000_000 }],
      flexible: [
        { key: "food", amount: 70_000 },
        { key: "fun", amount: 50_000 },
      ],
    });
  });
});

describe("categoryRanks", () => {
  it("ranks the biggest categories each month, ordered by the latest month", () => {
    const rows = [
      r("2026-10-01", "food", 500),
      r("2026-10-01", "fun", 100),
      r("2026-11-01", "food", 100),
      r("2026-11-01", "fun", 300),
      r("2026-11-01", "tiny", 1),
    ];
    const out = categoryRanks(rows, ["2026-10", "2026-11"], 2);
    expect(out).toEqual([
      { key: "fun", ranks: [2, 1], totals: [10_000, 30_000] },
      { key: "food", ranks: [1, 2], totals: [50_000, 10_000] },
    ]);
  });

  it("leaves a gap for a month with nothing spent", () => {
    const out = categoryRanks([r("2026-11-01", "food", 100)], ["2026-10", "2026-11"]);
    expect(out[0]?.ranks).toEqual([null, 1]);
  });
});
