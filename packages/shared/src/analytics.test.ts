import { describe, expect, it } from "vitest";
import {
  type AnalyticsRow,
  analyticsWindow,
  biggestShift,
  categoryMix,
  dailyExpenses,
  dayStats,
  heatLevel,
  heatLevels,
  moneyFlow,
  movers,
  OTHER,
  repeatSpends,
  runningTotals,
  savingsRates,
  sizeStats,
  spendCurve,
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

describe("movers", () => {
  it("compares the same days of last month while a month is running", () => {
    const m = movers(
      [
        row("2026-10-03", 500, "food"),
        row("2026-10-20", 9_999, "food"), // after day 15: not compared
        row("2026-11-04", 800, "food"),
        row("2026-10-10", 400, "fun"),
      ],
      "2026-11",
      "2026-11-15",
    );
    expect(m).toEqual([
      { categoryId: "fun", previous: 400, current: 0, change: -400 },
      { categoryId: "food", previous: 500, current: 800, change: 300 },
    ]);
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

describe("categoryMix", () => {
  it("totals each month per category and finds the biggest shift", () => {
    const mix = categoryMix(
      [
        row("2026-09-01", 100, "food"),
        row("2026-09-01", 100, "fun"),
        row("2026-10-01", 300, "food"),
        row("2026-10-01", 100, "fun"),
        row("2026-11-01", 999, "food"), // outside the window
      ],
      ["2026-09", "2026-10"],
    );
    expect(mix.keys).toEqual(["food", "fun"]);
    expect(mix.months).toEqual([
      { month: "2026-09", values: { food: 100, fun: 100 }, total: 200 },
      { month: "2026-10", values: { food: 300, fun: 100 }, total: 400 },
    ]);
    expect(biggestShift(mix)).toEqual({ key: "food", from: 0.5, to: 0.75 });
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

describe("sizeStats", () => {
  it("finds the median and how much the biggest tenth accounts for", () => {
    const amounts = [10, 10, 10, 10, 10, 10, 10, 10, 10, 910];
    expect(sizeStats(amounts)).toEqual({ count: 10, median: 10, topCount: 1, topShare: 0.91 });
    expect(sizeStats([])).toBeNull();
  });
});

describe("repeatSpends", () => {
  it("groups by note ignoring case and spacing, and spots monthly ones", () => {
    const r = repeatSpends([
      row("2026-08-05", 649, "fun", "expense", "Netflix"),
      row("2026-09-05", 649, "fun", "expense", "netflix "),
      row("2026-10-05", 649, "fun", "expense", "NETFLIX"),
      row("2026-10-06", 300, "food", "expense", "Swiggy"),
      row("2026-10-07", 500, "food", "expense", "swiggy"),
      row("2026-10-08", 100, "food", "expense", "One-off"),
      row("2026-10-09", 900, "s", "income", "Swiggy"),
    ]);
    expect(r).toEqual([
      { note: "NETFLIX", categoryId: "fun", count: 3, total: 1947, monthly: true, latest: 649 },
      { note: "swiggy", categoryId: "food", count: 2, total: 800, monthly: false, latest: 500 },
    ]);
  });
});
