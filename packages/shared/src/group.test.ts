import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay, monthTitle } from "./group";

const tx = (
  date: string,
  amount: number,
  createdAt: string,
  type: "expense" | "income" = "expense",
) => ({ date, amount, createdAt, type });

describe("dayLabel", () => {
  it("names today and yesterday, formats the rest", () => {
    expect(dayLabel("2026-11-10", "2026-11-10")).toBe("Today");
    expect(dayLabel("2026-11-09", "2026-11-10")).toBe("Yesterday");
    expect(dayLabel("2026-11-08", "2026-11-10")).toBe("Sun, Nov 8");
  });

  it("handles month boundaries for yesterday", () => {
    expect(dayLabel("2026-10-31", "2026-11-01")).toBe("Yesterday");
  });
});

describe("groupByDay", () => {
  it("groups newest day first, newest entry first, and totals only expenses", () => {
    const groups = groupByDay(
      [
        tx("2026-11-09", 500, "2026-11-09T10:00:00Z"),
        tx("2026-11-10", 180, "2026-11-10T08:00:00Z"),
        tx("2026-11-10", 246, "2026-11-10T09:00:00Z"),
        tx("2026-11-10", 85000, "2026-11-10T07:00:00Z", "income"),
      ],
      "2026-11-10",
    );
    expect(groups.map((g) => g.date)).toEqual(["2026-11-10", "2026-11-09"]);
    expect(groups[0]?.spent).toBe(426);
    expect(groups[0]?.items.map((i) => i.amount)).toEqual([246, 180, 85000]);
    expect(groups[1]?.label).toBe("Yesterday");
  });

  it("returns an empty list for no transactions", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("monthTitle", () => {
  it("formats a month", () => {
    expect(monthTitle("2026-11")).toBe("November 2026");
  });
});
