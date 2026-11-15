import { describe, expect, it } from "vitest";
import { budgetNudgeMessage, budgetNudges, budgetProgress } from "./budget";

describe("budgetProgress", () => {
  it("is empty and ok with no spending", () => {
    expect(budgetProgress(0, 600000)).toMatchObject({
      filled: 0,
      state: "ok",
      remaining: 600000,
      over: 0,
    });
  });

  it("fills proportionally while comfortably under", () => {
    const p = budgetProgress(300000, 600000); // 50%
    expect(p.filled).toBe(5);
    expect(p.state).toBe("ok");
    expect(p.remaining).toBe(300000);
  });

  it("lights at least one block for tiny spending", () => {
    expect(budgetProgress(1, 600000).filled).toBe(1);
  });

  it("warns from 80% up to and including 100%", () => {
    expect(budgetProgress(479999, 600000).state).toBe("ok");
    expect(budgetProgress(480000, 600000).state).toBe("warning"); // exactly 80%
    expect(budgetProgress(600000, 600000).state).toBe("warning"); // exactly 100%
  });

  it("never shows a full meter while there is room left", () => {
    expect(budgetProgress(599000, 600000).filled).toBe(9);
    expect(budgetProgress(600000, 600000).filled).toBe(10);
  });

  it("goes over only past 100% and reports by how much", () => {
    const p = budgetProgress(606000, 600000);
    expect(p).toMatchObject({ state: "over", filled: 10, remaining: 0, over: 6000 });
  });

  it("treats spending against a zero limit as over", () => {
    expect(budgetProgress(100, 0)).toMatchObject({ state: "over", filled: 10, over: 100 });
    expect(budgetProgress(0, 0)).toMatchObject({ state: "ok", filled: 0 });
  });
});

describe("budgetNudges", () => {
  const budget = { overall: 100_000, categories: { food: 10_000 } };
  const nudge = (categorySpent: number, delta: number, totalSpent = 0) =>
    budgetNudges({
      categoryId: "food",
      categoryDelta: delta,
      totalDelta: delta,
      categorySpent,
      totalSpent,
      budget,
    });

  it("speaks up when an expense crosses 80%", () => {
    const [n] = nudge(8_500, 1_000);
    expect(n).toMatchObject({ scope: "category", categoryId: "food", state: "warning" });
  });

  it("speaks up when an expense goes over", () => {
    expect(nudge(10_500, 1_000)[0]?.state).toBe("over");
    // Straight from ok to over is still one nudge, the worse one.
    expect(nudge(12_000, 6_000)).toHaveLength(1);
    expect(nudge(12_000, 6_000)[0]?.state).toBe("over");
  });

  it("stays quiet when nothing changed state", () => {
    expect(nudge(5_000, 1_000)).toEqual([]); // still ok
    expect(nudge(9_000, 500)).toEqual([]); // already warning
    expect(nudge(12_000, 500)).toEqual([]); // already over
    expect(nudge(10_000, 0)).toEqual([]); // nothing added
  });

  it("treats exactly the limit as a warning, not over", () => {
    expect(nudge(10_000, 3_000)[0]?.state).toBe("warning"); // 70% → exactly 100%
  });

  it("uses separate deltas for the category and the month", () => {
    // An edit that moves ₹30 into food from another category: food grows, the total doesn't.
    const moved = budgetNudges({
      categoryId: "food",
      categoryDelta: 3_000,
      totalDelta: 0,
      categorySpent: 9_000,
      totalSpent: 90_000,
      budget,
    });
    expect(moved.map((n) => n.scope)).toEqual(["category"]);
  });

  it("checks the overall budget too, and ignores missing budgets", () => {
    const both = nudge(9_000, 2_000, 81_000); // food 70%→90%, overall 79%→81%
    expect(both.map((n) => n.scope)).toEqual(["category", "overall"]);
    expect(
      budgetNudges({
        categoryId: "travel",
        categoryDelta: 5_000,
        totalDelta: 5_000,
        categorySpent: 99_000,
        totalSpent: 0,
        budget: { overall: null, categories: {} },
      }),
    ).toEqual([]);
  });
});

describe("budgetNudgeMessage", () => {
  const money = (n: number) => `₹${n / 100}`;
  it("says how much is left, or how far over", () => {
    const [warning] = budgetNudges({
      categoryId: "food",
      categoryDelta: 1_000,
      totalDelta: 1_000,
      categorySpent: 8_500,
      totalSpent: 0,
      budget: { overall: null, categories: { food: 10_000 } },
    });
    expect(warning && budgetNudgeMessage(warning, "Food", money)).toBe("Food: 85% used · ₹15 left");
    const [over] = budgetNudges({
      categoryId: "food",
      categoryDelta: 3_000,
      totalDelta: 3_000,
      categorySpent: 3_000,
      totalSpent: 12_500, // 95% → 125%
      budget: { overall: 10_000, categories: {} },
    });
    expect(over && budgetNudgeMessage(over, "Food", money)).toBe(
      "Monthly budget: over budget by ₹25",
    );
  });
});
