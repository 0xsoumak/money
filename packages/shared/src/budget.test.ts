import { describe, expect, it } from "vitest";
import { budgetProgress } from "./budget";

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
