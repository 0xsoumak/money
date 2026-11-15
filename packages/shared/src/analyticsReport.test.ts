import { describe, expect, it } from "vitest";
import type { AnalyticsRow } from "./analytics";
import {
  analyticsHeadlines,
  analyticsKpis,
  analyticsReport,
  shortDate,
  shortMonth,
  weekdayHeadline,
} from "./analyticsReport";

const row = (
  date: string,
  amount: number,
  categoryId = "food",
  type: AnalyticsRow["type"] = "expense",
  note: string | null = null,
): AnalyticsRow => ({ date, amount, categoryId, type, note });

const money = (minor: number) => `₹${minor / 100}`;
const nameOf = (key: string) => key.toUpperCase();

describe("labels", () => {
  it("formats months and dates without timezones", () => {
    expect(shortMonth("2026-11")).toBe("Nov");
    expect(shortDate("2026-11-07")).toBe("Sat, 7 Nov");
  });
});

describe("analyticsReport", () => {
  const rows = [
    row("2026-10-01", 100_000, "salary", "income"),
    row("2026-10-02", 25_000, "mf", "investment"),
    row("2026-10-03", 4_000, "food"),
    row("2026-10-04", 1_000, "fun"),
    row("2026-11-01", 100_000, "salary", "income"),
    row("2026-11-02", 3_000, "food"),
    row("2026-11-03", 3_000, "fun"),
  ];
  const a = analyticsReport(rows, "2026-11", 3, "2026-11-15");

  it("knows the month is still running", () => {
    expect(a.running).toBe(true);
    expect(a.win.dates.at(-1)).toBe("2026-11-15");
  });

  it("builds the KPI strip", () => {
    const k = analyticsKpis(a, money);
    expect(k.map((s) => s.label)).toEqual(["Avg month", "Saved", "No-spend days", "Biggest day"]);
    // Full months only while November runs: Aug–Oct, and only October has data.
    expect(k[0]?.value).toBe("₹50");
    expect(k[1]).toMatchObject({ value: "25%", tone: "accent" });
  });

  it("writes one headline per chart", () => {
    const h = analyticsHeadlines(a, money, nameOf);
    expect(h.flow).toEqual([
      { text: "You kept " },
      { text: "94%", accent: true },
      { text: " of what came in." },
    ]);
    expect(h.movers).toBe("FUN up ₹20, FOOD down ₹10.");
    expect(h.curve).toBe("₹10 more than this point last month.");
  });
});

describe("weekdayHeadline", () => {
  it("calls out pricey weekends", () => {
    expect(weekdayHeadline([100, 100, 100, 100, 100, 200, 200])).toBe(
      "Weekends cost 2× a weekday.",
    );
    expect(weekdayHeadline([100, 100, 100, 100, 100, 100, 100])).toBe(
      "Spending is even across the week.",
    );
  });
});
