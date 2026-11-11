import { describe, expect, it } from "vitest";
import { changeVs, monthInsights, overviewStats } from "./insights";

const tx = (date: string, amount: number, type: "expense" | "income" = "expense") => ({
  date,
  amount,
  type,
});
const money = (m: number) => `₹${m / 100}`;

describe("monthInsights", () => {
  it("counts elapsed days, totals per day and the peak for the current month", () => {
    const ins = monthInsights({
      month: "2026-11",
      todayDate: "2026-11-10",
      spent: 30000,
      transactions: [
        tx("2026-11-02", 10000),
        tx("2026-11-02", 5000),
        tx("2026-11-05", 15000),
        tx("2026-11-01", 999999, "income"),
      ],
      overallBudget: 300000,
    });
    expect(ins.days).toBe(30);
    expect(ins.elapsed).toBe(10);
    expect(ins.isCurrent).toBe(true);
    expect(ins.daily.get("2026-11-02")).toBe(15000);
    expect(ins.daily.has("2026-11-01")).toBe(false);
    expect(ins.peak).toEqual({ date: "2026-11-02", total: 15000 });
    expect(ins.average).toBe(3000);
    expect(ins.projected).toBe(90000);
    expect(ins.dailyBudget).toBe(10000);
  });

  it("uses every day for a past month and none for a future one", () => {
    const base = { spent: 0, transactions: [], overallBudget: null, todayDate: "2026-11-10" };
    expect(monthInsights({ ...base, month: "2026-02" }).elapsed).toBe(28);
    const future = monthInsights({ ...base, month: "2026-12" });
    expect(future.elapsed).toBe(0);
    expect(future.average).toBe(0);
    expect(future.peak).toBeNull();
    expect(future.dailyBudget).toBeNull();
  });

  it("rounds the average to whole currency units", () => {
    const ins = monthInsights({
      month: "2026-10",
      todayDate: "2026-11-10",
      spent: 100001,
      transactions: [],
      overallBudget: null,
    });
    expect(ins.average % 100).toBe(0);
  });
});

describe("overviewStats", () => {
  it("flags a pace that overshoots the budget", () => {
    const ins = monthInsights({
      month: "2026-11",
      todayDate: "2026-11-10",
      spent: 50000,
      transactions: [tx("2026-11-03", 50000)],
      overallBudget: 100000,
    });
    const [avg, pace, last, big] = overviewStats(ins, {
      spent: 50000,
      prevSpent: 40000,
      overallBudget: 100000,
      money,
    });
    expect(avg?.value).toBe("₹50");
    expect(pace).toMatchObject({ label: "On pace for", value: "₹1500", tone: "danger" });
    expect(pace?.hint).toBe("₹500 over budget");
    expect(last?.hint).toBe("125% of it spent so far");
    expect(big?.value).toBe("₹500");
  });

  it("shows days spent and the change for a past month", () => {
    const ins = monthInsights({
      month: "2026-10",
      todayDate: "2026-11-10",
      spent: 31000,
      transactions: [tx("2026-10-01", 31000)],
      overallBudget: null,
    });
    const [, pace, last] = overviewStats(ins, {
      spent: 31000,
      prevSpent: 62000,
      overallBudget: null,
      money,
    });
    expect(pace).toMatchObject({ label: "Days spent", value: "1 of 31", hint: "30 no-spend days" });
    expect(last?.hint).toBe("▼ 50% less this month");
  });
});

describe("changeVs", () => {
  it("returns null without a baseline", () => {
    expect(changeVs(100, 0)).toBeNull();
    expect(changeVs(150, 100)).toBe("▲ 50% more");
  });
});
