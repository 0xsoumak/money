import { describe, expect, it } from "vitest";
import type { AnalyticsRow } from "./analytics";
import { decisionActions, decisions } from "./decisions";

const row = (
  date: string,
  type: AnalyticsRow["type"],
  rupees: number,
  categoryId = "food",
): AnalyticsRow => ({ date, type, categoryId, amount: rupees * 100, note: null });

const money = (m: number) => `₹${Math.round(m / 100)}`;
const name = (id: string) => id[0]?.toUpperCase() + id.slice(1);
const none = { overall: null, byCategory: {} };

describe("decisions", () => {
  it("ignores months before anything was logged", () => {
    const d = decisions({
      rows: [row("2026-11-03", "expense", 500)],
      month: "2026-11",
      range: 6,
      todayDate: "2026-11-23",
      budgets: none,
    });
    expect(d.history).toEqual([]);
    expect(d.spending.usualByNow).toBeNull();
    expect(d.consistency.steadiness).toBe("early");
    // Without history the projection carries today's pace forward.
    expect(d.spending.projected).toBe(Math.round((50_000 / 23) * 30));
  });

  it("compares this month with earlier months at the same day", () => {
    const rows = [
      // October: 1000 by the 10th, 4000 more on the 25th.
      row("2026-10-05", "expense", 1000),
      row("2026-10-25", "expense", 4000),
      // November so far (today is the 10th).
      row("2026-11-02", "expense", 3000),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-10",
      budgets: none,
    });
    expect(d.spending.usualByNow).toBe(100_000);
    expect(d.spending.usualMonth).toBe(500_000);
    // So far plus what October spent after its 10th.
    expect(d.spending.projected).toBe(300_000 + 400_000);
    expect(d.spending.movers).toEqual([
      { key: "food", now: 300_000, usual: 100_000, diff: 200_000 },
    ]);
  });

  it("counts investing streaks and doesn't call a running month missed", () => {
    const rows = [
      row("2026-08-01", "expense", 10),
      row("2026-09-05", "investment", 5000),
      row("2026-10-05", "investment", 5000),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 6,
      todayDate: "2026-11-03",
      budgets: none,
    });
    expect(d.consistency.months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(d.consistency.investedMonths).toBe(2);
    expect(d.consistency.streak).toBe(2);
    expect(d.consistency.steadiness).toBe("irregular");
  });

  it("projects the overall budget and suggests one when unset", () => {
    const rows = [row("2026-10-10", "expense", 20_000), row("2026-11-05", "expense", 15_000)];
    const withBudget = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-15",
      budgets: { overall: 25_000_00, byCategory: { food: 10_000_00 } },
    });
    expect(withBudget.budget.overall).toEqual({
      limit: 25_000_00,
      expectedByNow: 12_500_00,
      within: 1,
      counted: 1,
    });
    expect(withBudget.budget.categories[0]).toMatchObject({ key: "food", spent: 15_000_00 });

    const without = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-15",
      budgets: none,
    });
    expect(without.budget.overall).toBeNull();
    expect(without.budget.suggested).toBe(20_000_00);
  });
});

describe("decisionActions", () => {
  it("leads with drawing on savings, then the budget pace", () => {
    const rows = [
      row("2026-10-03", "expense", 20_000),
      row("2026-10-25", "expense", 10_000), // what usually comes late in the month
      row("2026-11-01", "income", 10_000),
      row("2026-11-03", "expense", 18_000),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-20",
      budgets: { overall: 25_000_00, byCategory: {} },
    });
    const actions = decisionActions(d, money, name);
    expect(actions[0]?.id).toBe("shortfall");
    expect(actions[1]?.id).toBe("budget-pace");
    expect(actions[1]?.text).toContain("₹700 a day for the next 10 days");
  });

  it("nudges to invest when this month has nothing yet", () => {
    const rows = [row("2026-10-05", "investment", 5000), row("2026-11-02", "expense", 100)];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-20",
      budgets: none,
    });
    const ids = decisionActions(d, money, name).map((a) => a.id);
    expect(ids).toContain("invest-missing");
  });

  it("says when there's no history to compare with yet", () => {
    const d = decisions({
      rows: [row("2026-11-02", "expense", 100)],
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-20",
      budgets: none,
    });
    expect(decisionActions(d, money, name).map((a) => a.id)).toEqual(["early"]);
  });
});
