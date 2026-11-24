import { describe, expect, it } from "vitest";
import { type AnalyticsRow, moneyFlow } from "./analytics";
import { decisions } from "./decisions";
import { heroStats, investingTakeaway, moneyFlowTakeaway } from "./takeaways";

const row = (date: string, type: AnalyticsRow["type"], rupees: number): AnalyticsRow => ({
  date,
  type,
  amount: rupees * 100,
  categoryId: type === "expense" ? "food" : type,
  note: null,
});
const money = (m: number) => `₹${Math.round(m / 100)}`;
const none = { overall: null, byCategory: {} };

const rows = [
  row("2026-09-05", "income", 1000),
  row("2026-09-06", "expense", 600),
  row("2026-10-05", "income", 1000),
  row("2026-10-06", "expense", 700),
  row("2026-11-05", "income", 1000),
  row("2026-11-06", "expense", 500),
  row("2026-11-07", "investment", 200),
];
const d = decisions({
  rows,
  month: "2026-11",
  range: 6,
  todayDate: "2026-11-20",
  budgets: none,
  fixedIds: new Set(),
});

describe("takeaways", () => {
  it("encourages a first month of investing instead of flagging the gap", () => {
    expect(investingTakeaway(d, money)).toEqual([
      "20% of income · your first month investing",
      "good",
    ]);
  });

  it("reads the money flow", () => {
    const f = moneyFlow(rows, "2026-11");
    expect(moneyFlowTakeaway(f, money)).toEqual(["You kept 30% of what came in", "good"]);
    expect(moneyFlowTakeaway({ ...f, shortfall: 5000, kept: 0 }, money)[1]).toBe("warn");
  });

  it("gives four big numbers, with the budget outlook while the month runs", () => {
    const f = moneyFlow(rows, "2026-11");
    const stats = heroStats(
      { d, flow: f, budget: 400_00, spentDays: 1, counted: 20 },
      money,
      money,
    );
    expect(stats.map((s) => s.label)).toEqual([
      "Spent so far",
      "Likely by month end",
      "Kept",
      "Invested",
    ]);
    expect(stats[1]?.tone).toBe("warn");
    expect(stats[2]?.value).toBe("₹300");
    expect(stats[3]?.sub).toBe("20% of income");
  });
});
