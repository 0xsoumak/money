import { describe, expect, it } from "vitest";
import type { AnalyticsRow } from "./analytics";
import { against, decisionActions, decisions, typicalRange } from "./decisions";

const row = (
  date: string,
  type: AnalyticsRow["type"],
  rupees: number,
  categoryId = "food",
): AnalyticsRow => ({ date, type, categoryId, amount: rupees * 100, note: null });

const money = (m: number) => `₹${Math.round(m / 100)}`;
const name = (id: string) => id[0]?.toUpperCase() + id.slice(1);
const none = { overall: null, byCategory: {} };
/** Something logged every day up to `day`, so logging never reads as thin. */
const everyDay = (month: string, day: number) =>
  Array.from({ length: day }, (_, i) =>
    row(`${month}-${String(i + 1).padStart(2, "0")}`, "income", 1, "salary"),
  );

describe("typicalRange", () => {
  it("is the median with lowest to highest for few values", () => {
    expect(typicalRange([300, 100, 200])).toEqual({ low: 100, mid: 200, high: 300, n: 3 });
    expect(typicalRange([])).toBeNull();
  });

  it("uses the middle half once there are four or more, so one odd month can't drag it", () => {
    const r = typicalRange([100, 110, 120, 130, 10_000]);
    expect(r).toMatchObject({ low: 110, mid: 120, high: 130 });
  });

  it("allows some slack before calling a value above or below", () => {
    const r = { low: 1_000_000, mid: 1_000_000, high: 1_000_000, n: 1 };
    expect(against(1_050_000, r)).toBe("within"); // within 10%
    expect(against(1_200_000, r)).toBe("above");
    expect(against(800_000, r)).toBe("below");
  });
});

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
    expect(d.confidence).toBe("none");
    expect(d.spending.verdict).toBeNull();
    expect(d.consistency.steadiness).toBe("early");
    // Without history the projection carries today's pace forward.
    expect(d.spending.projected.mid).toBe(Math.round((50_000 / 23) * 30));
  });

  it("compares flexible spending at the same day, and keeps fixed costs out of the verdict", () => {
    const rows = [
      row("2026-10-05", "expense", 1000),
      row("2026-10-25", "expense", 4000),
      row("2026-10-01", "expense", 20_000, "rent"),
      // November so far (today is the 10th): rent is the same, food is up.
      row("2026-11-01", "expense", 20_000, "rent"),
      row("2026-11-02", "expense", 3000),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-10",
      budgets: none,
      fixedIds: new Set(["rent"]),
    });
    expect(d.confidence).toBe("early");
    expect(d.current).toMatchObject({ fixed: 2_000_000, flexible: 300_000 });
    expect(d.spending.usualByNow?.mid).toBe(100_000);
    expect(d.spending.verdict).toBe("above");
    // Fixed as usual, plus flexible so far, plus what October spent after its 10th.
    expect(d.spending.projected.mid).toBe(2_000_000 + 300_000 + 400_000);
    // Only flexible categories show up as movers.
    expect(d.spending.movers.map((m) => m.key)).toEqual(["food"]);
  });

  it("expects the usual fixed costs even before they're paid", () => {
    const rows = [row("2026-10-01", "expense", 20_000, "rent"), row("2026-11-02", "expense", 100)];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-10",
      budgets: none,
      fixedIds: new Set(["rent"]),
    });
    expect(d.spending.projected.mid).toBe(2_000_000 + 10_000);
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

  it("flags thin logging after the first week", () => {
    const rows = [row("2026-11-02", "expense", 100), row("2026-11-03", "expense", 100)];
    const at = (todayDate: string) =>
      decisions({ rows, month: "2026-11", range: 3, todayDate, budgets: none }).logging;
    expect(at("2026-11-05")).toMatchObject({ loggedDays: 2, thin: false });
    expect(at("2026-11-20")).toMatchObject({ loggedDays: 2, thin: true });
  });

  it("projects the overall budget and suggests one that covers a normal month", () => {
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
      ...everyDay("2026-11", 20),
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
      fixedIds: new Set(["rent"]),
    });
    const actions = decisionActions(d, money, name);
    expect(actions[0]?.id).toBe("shortfall");
    expect(actions[1]?.id).toBe("budget-pace");
    expect(actions[1]?.text).toContain("₹700 a day for the next 10 days");
  });

  it("holds pace warnings for the first week", () => {
    const rows = [
      ...everyDay("2026-11", 3),
      row("2026-10-25", "expense", 30_000),
      row("2026-11-02", "expense", 5000),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-03",
      budgets: { overall: 25_000_00, byCategory: {} },
      fixedIds: new Set(["rent"]),
    });
    expect(decisionActions(d, money, name).map((a) => a.id)).not.toContain("budget-pace");
  });

  it("praises nothing when logging is thin", () => {
    const rows = [row("2026-10-05", "expense", 50_000), row("2026-11-02", "expense", 100)];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-20",
      budgets: none,
      fixedIds: new Set(["rent"]),
    });
    const actions = decisionActions(d, money, name);
    expect(actions[0]?.id).toBe("thin");
    expect(actions.some((a) => a.tone === "good")).toBe(false);
  });

  it("asks to mark fixed costs when none are", () => {
    const d = decisions({
      rows: [...everyDay("2026-11", 20), row("2026-11-02", "expense", 100)],
      month: "2026-11",
      range: 3,
      todayDate: "2026-11-20",
      budgets: none,
    });
    expect(decisionActions(d, money, name).map((a) => a.id)).toContain("mark-fixed");
  });
});

describe("decisions: charts", () => {
  it("gives this month's running total and the usual running total for every day", () => {
    const rows = [
      row("2026-09-02", "expense", 100),
      row("2026-09-20", "expense", 300),
      row("2026-10-02", "expense", 200),
      row("2026-10-20", "expense", 500),
      row("2026-11-01", "expense", 50),
      row("2026-11-03", "expense", 25),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 6,
      todayDate: "2026-11-05",
      budgets: none,
    });
    expect(d.spending.pace.current).toEqual([5000, 5000, 7500, 7500, 7500]);
    const usual = d.spending.pace.usual;
    expect(usual).toHaveLength(30);
    // Two months of history: lowest to highest, by the same day.
    expect(usual?.[1]).toEqual({ low: 10_000, mid: 15_000, high: 20_000 });
    expect(usual?.[29]).toEqual({ low: 40_000, mid: 55_000, high: 70_000 });
  });

  it("has no usual pace without history", () => {
    const d = decisions({
      rows: [row("2026-11-03", "expense", 500)],
      month: "2026-11",
      range: 6,
      todayDate: "2026-11-04",
      budgets: none,
    });
    expect(d.spending.pace.usual).toBeNull();
    expect(d.spending.pace.current).toEqual([0, 0, 50_000, 50_000]);
  });

  it("compares every flexible category, not only the notable ones, biggest first", () => {
    const rows = [
      row("2026-10-03", "expense", 1000, "food"),
      row("2026-10-03", "expense", 100, "fun"),
      row("2026-10-03", "expense", 20_000, "rent"),
      row("2026-11-03", "expense", 3000, "food"),
      row("2026-11-03", "expense", 110, "fun"),
      row("2026-11-03", "expense", 20_000, "rent"),
    ];
    const d = decisions({
      rows,
      month: "2026-11",
      range: 6,
      todayDate: "2026-11-10",
      budgets: none,
      fixedIds: new Set(["rent"]),
    });
    expect(d.spending.byCategory.map((c) => c.key)).toEqual(["food", "fun"]);
    expect(d.spending.movers.map((c) => c.key)).toEqual(["food"]);
  });
});
